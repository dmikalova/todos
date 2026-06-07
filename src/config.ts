// Application configuration - read once from environment at startup
// Loads secrets from mounted JSON file, then reads env vars with defaults.
// Tests can override via _setConfigForTest() without mutating Deno.env

export interface AppConfig {
  isDev: boolean;
  port: number;
  sessionDomain: string;
  supabaseUrl: string | null;
  db: {
    url: string | null;
    schema: string;
    max: number;
    idleTimeout: number;
    connectTimeout: number;
    acquireTimeout: number;
  };
}

const DEV_DATABASE_URL =
  "postgres://tasks_app:tasks_app@localhost:5432/tasks?search_path=tasks&sslmode=disable";

const SECRETS_PATH = "/secrets/config.json";

// Load secrets from JSON file mounted by Secret Manager volume.
// Returns a map of key/value pairs; returns empty map if file doesn't exist.
export function loadSecrets(
  path: string = SECRETS_PATH,
): Record<string, string> {
  try {
    const json = Deno.readTextFileSync(path);
    return JSON.parse(json);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return {};
    }
    throw error;
  }
}

// Get a value from env, falling back to secrets, then to a default
function envOrSecret(
  key: string,
  secrets: Record<string, string>,
  fallback?: string,
): string | undefined {
  return Deno.env.get(key) ?? secrets[key] ?? fallback;
}

function loadConfig(): AppConfig {
  const secrets = loadSecrets();

  const isDev = envOrSecret("DENO_ENV", secrets) !== "production";
  const dbUrl = envOrSecret("DATABASE_URL_TRANSACTION", secrets) ||
    (isDev ? DEV_DATABASE_URL : null);

  return {
    isDev,
    port: parseInt(envOrSecret("PORT", secrets, "8000")!),
    sessionDomain: envOrSecret("SESSION_DOMAIN", secrets, "mklv.tech")!,
    supabaseUrl: envOrSecret("SUPABASE_URL", secrets) || null,
    db: {
      url: dbUrl,
      schema: envOrSecret("DATABASE_SCHEMA", secrets, "tasks")!,
      max: parseInt(envOrSecret("DATABASE_POOL_MAX", secrets, "10")!),
      idleTimeout: parseInt(
        envOrSecret("DATABASE_IDLE_TIMEOUT", secrets, "30")!,
      ),
      connectTimeout: parseInt(
        envOrSecret("DATABASE_CONNECT_TIMEOUT", secrets, "10")!,
      ),
      acquireTimeout: parseInt(
        envOrSecret("DATABASE_ACQUIRE_TIMEOUT", secrets, "30")!,
      ),
    },
  };
}

let config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!config) {
    config = loadConfig();
  }
  return config;
}

// Test-only: override config without touching Deno.env
export function _setConfigForTest(overrides: Partial<AppConfig>): void {
  const current = getConfig();
  config = { ...current, ...overrides };
  if (overrides.db) {
    config.db = { ...current.db, ...overrides.db };
  }
}

// Test-only: reset config back to env-based values
export function _resetConfig(): void {
  config = null;
}
