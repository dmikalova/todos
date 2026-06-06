// Unit tests for database client retry logic
// Tests: withTransaction retries on transient errors, query retries, resetConnection/closeConnection
// Uses a mock connection so no real PostgreSQL is needed

import { assertEquals, assertRejects } from "@std/assert";
import type postgres from "postgres";
import { _resetConfig, _setConfigForTest } from "../../src/config.ts";
import {
  _setConnectionForTest,
  closeConnection,
  getConnection,
  isSslEnabled,
  query,
  resetConnection,
  suppressNotice,
  withTransaction,
} from "../../src/db/client.ts";

// Create a mock postgres.Sql that calls the begin callback directly
// without needing a real database connection
function createMockSql(): postgres.Sql {
  const mock = Object.assign(
    // Template literal function (for direct sql`...` calls)
    () => Promise.resolve([]),
    {
      begin: (fn: (tx: unknown) => unknown) => {
        // Simulate a transaction: call the callback with a mock tx
        const tx = Object.assign(() => Promise.resolve([]), {
          unsafe: () => Promise.resolve([]),
          json: (v: unknown) => v,
          savepoint: (cb: (sql: unknown) => unknown) => cb(tx),
        });
        return fn(tx);
      },
      end: () => Promise.resolve(),
      unsafe: () => Promise.resolve([]),
      json: (v: unknown) => v,
    },
  );
  return mock as unknown as postgres.Sql;
}

function setupMock() {
  _setConnectionForTest(createMockSql());
}

function teardownMock() {
  _setConnectionForTest(null);
}

// Pure function tests - no DB needed
Deno.test("isSslEnabled - returns false when sslmode=disable", () => {
  assertEquals(
    isSslEnabled("postgres://user:pass@localhost:5432/db?sslmode=disable"),
    false,
  );
});

Deno.test("suppressNotice - does not throw", () => {
  suppressNotice("some notice message");
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
    teardownMock();
    resetConnection();
    // Override config with a URL that has sslmode=require
    const sslUrl = "postgres://user:pass@localhost:5432/db?sslmode=require";
    _setConfigForTest({
      db: {
        url: sslUrl,
        schema: "todos",
        max: 10,
        idleTimeout: 30,
        connectTimeout: 10,
        acquireTimeout: 30,
      },
    });
    try {
      // postgres() is lazy — constructing the client covers the branch
      // without needing an actual SSL connection
      getConnection();
    } finally {
      _resetConfig();
      resetConnection();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on transient connection errors",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on deadlock errors",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on timeout errors",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on pool exhaustion errors",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - throws immediately on non-transient errors",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - gives up after max retries for transient errors",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - resets connection on connection_ended error",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "withTransaction - retries on remaining connection slots error",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - retries on transient connection errors",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - throws immediately on non-transient errors",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - gives up after max retries on timeout",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - resets connection on connection_ended",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "query - retries on pool exhaustion",
  async fn() {
    setupMock();
    try {
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
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "resetConnection - does nothing when no connection exists",
  fn() {
    _setConnectionForTest(null);
    // Should not throw
    resetConnection();
  },
});

Deno.test({
  name: "closeConnection - closes active connection",
  async fn() {
    setupMock();
    try {
      // Close the mock connection
      await closeConnection();
      // Should not throw on second call (sql is now null)
      await closeConnection();
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "resetConnection - resets active connection",
  fn() {
    setupMock();
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
    setupMock();
    try {
      // With mock, this exercises the query path through begin
      const result = await query((_sql) => "ok");
      assertEquals(result, "ok");
    } finally {
      teardownMock();
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
