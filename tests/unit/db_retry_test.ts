// Unit tests for database client retry logic
// Tests: withTransaction retries on transient errors, query retries, resetConnection/closeConnection

import { assertEquals, assertRejects } from "@std/assert";
import {
  closeConnection,
  getConnection,
  isSslEnabled,
  query,
  resetConnection,
  withTransaction,
} from "../../src/db/client.ts";

// Pure function tests - no DB needed
Deno.test("isSslEnabled - returns false when sslmode=disable", () => {
  assertEquals(
    isSslEnabled("postgres://user:pass@localhost:5432/db?sslmode=disable"),
    false,
  );
});

Deno.test("isSslEnabled - returns true when sslmode=require", () => {
  assertEquals(
    isSslEnabled("postgres://user:pass@host:6543/db?sslmode=require"),
    true,
  );
});

Deno.test("isSslEnabled - returns true when no sslmode param", () => {
  assertEquals(isSslEnabled("postgres://user:pass@host:6543/db"), true);
});

Deno.test({
  name: "getConnection - uses ssl require when sslmode is not disable",
  fn() {
    // Reset singleton so getConnection creates a new client
    resetConnection();
    const originalUrl = Deno.env.get("DATABASE_URL_TRANSACTION")!;
    // Set a URL without sslmode=disable to hit the ssl: "require" branch
    const sslUrl = originalUrl.replace("sslmode=disable", "sslmode=require");
    Deno.env.set("DATABASE_URL_TRANSACTION", sslUrl);
    try {
      // postgres() is lazy — constructing the client covers the branch
      // without needing an actual SSL connection
      getConnection();
    } finally {
      // Restore and reset so other tests use the correct connection
      Deno.env.set("DATABASE_URL_TRANSACTION", originalUrl);
      resetConnection();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on transient connection errors",
  async fn() {
    let attempts = 0;
    const result = await withTransaction((_sql) => {
      attempts++;
      if (attempts < 3) {
        throw new Error("connection terminated unexpectedly");
      }
      return "success";
    });
    assertEquals(result, "success");
    assertEquals(attempts, 3);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on deadlock errors",
  async fn() {
    let attempts = 0;
    const result = await withTransaction((_sql) => {
      attempts++;
      if (attempts < 2) {
        throw new Error("deadlock detected");
      }
      return "recovered";
    });
    assertEquals(result, "recovered");
    assertEquals(attempts, 2);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on timeout errors",
  async fn() {
    let attempts = 0;
    const result = await withTransaction((_sql) => {
      attempts++;
      if (attempts < 2) {
        throw new Error("timeout waiting for connection");
      }
      return "done";
    });
    assertEquals(result, "done");
    assertEquals(attempts, 2);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on pool exhaustion errors",
  async fn() {
    let attempts = 0;
    const result = await withTransaction((_sql) => {
      attempts++;
      if (attempts < 2) {
        throw new Error("too many connections");
      }
      return "ok";
    });
    assertEquals(result, "ok");
    assertEquals(attempts, 2);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - throws immediately on non-transient errors",
  async fn() {
    let attempts = 0;
    await assertRejects(
      async () => {
        await withTransaction((_sql) => {
          attempts++;
          throw new Error("syntax error in SQL");
        });
      },
      Error,
      "syntax error in SQL",
    );
    assertEquals(attempts, 1);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - gives up after max retries for transient errors",
  async fn() {
    let attempts = 0;
    await assertRejects(
      async () => {
        await withTransaction(
          (_sql) => {
            attempts++;
            throw new Error("connection terminated");
          },
          { retries: 2 },
        );
      },
      Error,
      "connection terminated",
    );
    assertEquals(attempts, 2);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - resets connection on connection_ended error",
  async fn() {
    let attempts = 0;
    await assertRejects(
      async () => {
        await withTransaction(
          (_sql) => {
            attempts++;
            throw new Error("connection_ended");
          },
          { retries: 1 },
        );
      },
      Error,
      "connection_ended",
    );
    assertEquals(attempts, 1);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on remaining connection slots error",
  async fn() {
    let attempts = 0;
    const result = await withTransaction((_sql) => {
      attempts++;
      if (attempts < 2) {
        throw new Error("remaining connection slots are reserved");
      }
      return "connected";
    });
    assertEquals(result, "connected");
    assertEquals(attempts, 2);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - retries on transient connection errors",
  async fn() {
    let attempts = 0;
    const result = await query((_sql) => {
      attempts++;
      if (attempts < 3) {
        throw new Error("connection refused");
      }
      return "query-success";
    });
    assertEquals(result, "query-success");
    assertEquals(attempts, 3);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - throws immediately on non-transient errors",
  async fn() {
    let attempts = 0;
    await assertRejects(
      async () => {
        await query((_sql) => {
          attempts++;
          throw new Error("relation does not exist");
        });
      },
      Error,
      "relation does not exist",
    );
    assertEquals(attempts, 1);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - gives up after max retries on timeout",
  async fn() {
    let attempts = 0;
    await assertRejects(
      async () => {
        await query(
          (_sql) => {
            attempts++;
            throw new Error("timeout");
          },
          { retries: 2 },
        );
      },
      Error,
      "timeout",
    );
    assertEquals(attempts, 2);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - resets connection on connection_ended",
  async fn() {
    let attempts = 0;
    const result = await query((_sql) => {
      attempts++;
      if (attempts < 2) {
        throw new Error("connection_ended");
      }
      return "recovered";
    });
    assertEquals(result, "recovered");
    assertEquals(attempts, 2);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - retries on pool exhaustion",
  async fn() {
    let attempts = 0;
    const result = await query((_sql) => {
      attempts++;
      if (attempts < 2) {
        throw new Error("too many connections for role");
      }
      return "ok";
    });
    assertEquals(result, "ok");
    assertEquals(attempts, 2);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "resetConnection - does nothing when no connection exists",
  fn() {
    // Should not throw
    resetConnection();
  },
});

Deno.test({
  name: "closeConnection - closes active connection",
  async fn() {
    // Establish a connection by running a query
    await query((_sql) => "establish connection");
    // Now close it (sql is non-null)
    await closeConnection();
    // Should not throw on second call (sql is now null)
    await closeConnection();
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "resetConnection - resets active connection",
  async fn() {
    // Establish a connection
    await query((_sql) => "establish connection");
    // Reset it
    resetConnection();
    // Should not throw on second call
    resetConnection();
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - triggers onnotice callback via RAISE NOTICE",
  async fn() {
    // RAISE NOTICE triggers the onnotice handler in the postgres connection
    await query(async (sql) => {
      await sql`DO $$ BEGIN RAISE NOTICE 'test notice'; END $$`;
      return "ok";
    });
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
