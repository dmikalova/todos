// Integration tests for import error paths
// Tests the outer catch block (transaction failure) and simple /tasks catch block

import { assertEquals } from "@std/assert";
import {
  _resetConfig,
  _setConfigForTest,
  getConfig,
} from "../../src/config.ts";
import { resetConnection } from "../../src/db/client.ts";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Import Error Path Tests",
  async fn(t) {
    ctx = await setupTestContext();

    await t.step(
      "POST /api/import catches transaction failure in outer catch",
      async () => {
        const originalDb = getConfig().db;
        // Point to a port that refuses connections — triggers connection error
        _setConfigForTest({
          db: {
            ...originalDb,
            url: "postgres://x:x@localhost:1/db?sslmode=disable",
          },
        });
        resetConnection();
        try {
          const res = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
            projects: [{ name: "Integration Test Unreachable Project" }],
          });
          const body = await res.json();
          assertEquals(body.success, false);
          assertEquals(body.errors.length, 1);
          assertEquals(body.errors[0].startsWith("Transaction failed:"), true);
        } finally {
          _resetConfig();
          resetConnection();
        }
      },
    );

    await t.step(
      "POST /api/import/tasks catches per-item error in simple import",
      async () => {
        // Title > 500 chars violates valid_title_length CHECK constraint
        const longTitle = "Integration Test " + "x".repeat(500);
        const res = await apiCall(ctx.app, "POST", "/api/import/tasks", {
          tasks: [
            { title: longTitle },
            { title: "Integration Test Short Title" },
          ],
        });
        const body = await res.json();
        assertEquals(body.success, false);
        assertEquals(body.imported, 1);
        assertEquals(body.failed, 1);
        assertEquals(body.errors.length, 1);
        assertEquals(body.errors[0].includes(longTitle.slice(0, 50)), true);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
