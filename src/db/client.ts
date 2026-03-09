// Database configuration and connection pooling
// Configured for Supabase with Supavisor connection pooler (port 6543)

import postgres from "postgres";

export interface DatabaseConfig {
  url: string;
  schema: string;
  max?: number;
  idleTimeout?: number;
  connectTimeout?: number;
  acquireTimeout?: number;
}

// Common SQL interface for both regular and transaction queries
// Both postgres.Sql and postgres.TransactionSql are callable template literal functions
// We use a function type that accepts template strings and returns query results
export interface SqlQuery {
  <T extends postgres.MaybeRow[]>(
    template: TemplateStringsArray,
    ...args: unknown[]
  ): postgres.PendingQuery<T>;
  // JSON helper for serializing objects in queries
  json(value: unknown): postgres.Parameter<string>;
}

let sql: postgres.Sql | null = null;

export function getConfig(): DatabaseConfig {
  const url = Deno.env.get("DATABASE_URL_TRANSACTION");
  if (!url) {
    throw new Error(
      "DATABASE_URL_TRANSACTION environment variable is required",
    );
  }

  return {
    url,
    schema: Deno.env.get("DATABASE_SCHEMA") || "todos",
    max: parseInt(Deno.env.get("DATABASE_POOL_MAX") || "10"),
    idleTimeout: parseInt(Deno.env.get("DATABASE_IDLE_TIMEOUT") || "30"),
    connectTimeout: parseInt(Deno.env.get("DATABASE_CONNECT_TIMEOUT") || "10"),
    acquireTimeout: parseInt(Deno.env.get("DATABASE_ACQUIRE_TIMEOUT") || "30"),
  };
}

let schemaName: string | null = null;

export function getSchema(): string {
  if (!schemaName) {
    schemaName = Deno.env.get("DATABASE_SCHEMA") || "todos";
  }
  return schemaName;
}

export const SCHEMA = "todos";

export function getConnection(): postgres.Sql {
  if (sql) {
    return sql;
  }

  const config = getConfig();

  // Check if SSL should be disabled (for local development)
  const url = new URL(config.url);
  const sslMode = url.searchParams.get("sslmode");
  const sslEnabled = sslMode !== "disable";

  sql = postgres(config.url, {
    max: config.max,
    idle_timeout: config.idleTimeout,
    connect_timeout: config.connectTimeout,
    ssl: sslEnabled ? "require" : false,
    onnotice: () => {},
    transform: {
      undefined: null,
    },
    // Disable prepared statements - required for Supavisor transaction pooler
    prepare: false,
  });

  return sql;
}

export function resetConnection(): void {
  if (sql) {
    sql.end().catch(() => {});
    sql = null;
  }
}

export async function closeConnection(): Promise<void> {
  if (sql) {
    await sql.end();
    sql = null;
  }
}

// Transaction wrapper with automatic retry on transient errors
// Uses SqlQuery type which works for both Sql and TransactionSql
// userId sets `app.user_id` for RLS policies within the transaction
export async function withTransaction<T>(
  fn: (sql: SqlQuery) => Promise<T>,
  options?: { userId?: string; retries?: number },
): Promise<T> {
  const schema = getSchema();
  const retries = options?.retries ?? 3;
  const userId = options?.userId;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const connection = getConnection();
    try {
      const result = (await connection.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO ${schema}, public`);
        if (userId) {
          await tx.unsafe(
            `SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`,
          );
        }
        // Cast through unknown to break TypeScript's type tracking
        const sqlQuery: SqlQuery = tx as unknown as SqlQuery;
        return await fn(sqlQuery);
      })) as T;
      return result;
    } catch (error) {
      lastError = error as Error;

      const errorMessage = lastError.message.toLowerCase();
      const isConnectionDead = errorMessage.includes("connection_ended") ||
        errorMessage.includes("connection terminated") ||
        errorMessage.includes("connection refused");
      const isTransient = isConnectionDead ||
        errorMessage.includes("deadlock") ||
        errorMessage.includes("serialization") ||
        errorMessage.includes("connection") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("pool") ||
        errorMessage.includes("too many connections") ||
        errorMessage.includes("remaining connection slots");

      if (isConnectionDead) {
        console.log(`[DB] Connection dead, resetting pool: ${errorMessage}`);
        resetConnection();
      }

      if (!isTransient || attempt === retries - 1) {
        throw error;
      }

      const baseDelay = Math.pow(2, attempt) * 100;
      const jitter = Math.random() * 50;
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
    }
  }

  throw lastError;
}

// Simple query helper with retry logic
export async function query<T>(
  queryFn: (sql: SqlQuery) => Promise<T>,
  options?: { userId?: string; retries?: number },
): Promise<T> {
  const schema = getSchema();
  const retries = options?.retries ?? 3;
  const userId = options?.userId;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    const connection = getConnection();
    try {
      return (await connection.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL search_path TO ${schema}, public`);
        if (userId) {
          await tx.unsafe(
            `SET LOCAL app.user_id = '${userId.replace(/'/g, "''")}'`,
          );
        }
        // Cast through unknown to break TypeScript's type tracking
        const sqlQuery: SqlQuery = tx as unknown as SqlQuery;
        return await queryFn(sqlQuery);
      })) as T;
    } catch (error) {
      lastError = error as Error;

      const errorMessage = lastError.message.toLowerCase();
      const isConnectionDead = errorMessage.includes("connection_ended") ||
        errorMessage.includes("connection terminated") ||
        errorMessage.includes("connection refused");
      const isTransient = isConnectionDead ||
        errorMessage.includes("connection") ||
        errorMessage.includes("timeout") ||
        errorMessage.includes("pool") ||
        errorMessage.includes("too many connections") ||
        errorMessage.includes("remaining connection slots");

      if (isConnectionDead) {
        console.log(`[DB] Connection dead, resetting pool: ${errorMessage}`);
        resetConnection();
      }

      if (!isTransient || attempt === retries - 1) {
        throw error;
      }

      const baseDelay = Math.pow(2, attempt) * 100;
      const jitter = Math.random() * 50;
      await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
    }
  }

  throw lastError;
}

export function withDb<T>(
  fn: (sql: SqlQuery) => Promise<T>,
  options?: { userId?: string },
): Promise<T> {
  return query(fn, options);
}
