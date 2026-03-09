// Integration tests for Context CRUD
// Tests: create with windows, update replaces windows, delete cascades, list returns windows

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Context CRUD Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    let createdContextId: string;

    await t.step(
      "POST /api/contexts creates context with windows",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Work",
          color: "#1976D2",
          timeWindows: [
            { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
            { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
          ],
        });

        assertEquals(res.status, 201, `Expected 201 but got ${res.status}`);
        const body = await res.json();

        assertExists(body.id);
        assertEquals(body.name, "Test Context Work");
        assertEquals(body.color, "#1976D2");
        assertExists(body.time_windows);
        assertEquals(body.time_windows.length, 2);

        createdContextId = body.id;
      },
    );

    await t.step(
      "GET /api/contexts returns all contexts with windows",
      async () => {
        const res = await apiCall(ctx.app, "GET", "/api/contexts");

        assertEquals(res.status, 200);
        const body = await res.json();

        const testCtx = body.find((c: { id: string }) =>
          c.id === createdContextId
        );
        assertExists(testCtx);
        assertEquals(testCtx.name, "Test Context Work");
        assertExists(testCtx.time_windows);
        assertEquals(testCtx.time_windows.length, 2);
      },
    );

    await t.step("PATCH /api/contexts/:id replaces windows", async () => {
      const res = await apiCall(
        ctx.app,
        "PATCH",
        `/api/contexts/${createdContextId}`,
        {
          name: "Test Context Updated",
          timeWindows: [
            { dayOfWeek: 3, startTime: "10:00", endTime: "16:00" },
          ],
        },
      );

      assertEquals(res.status, 200);
      const body = await res.json();

      assertEquals(body.name, "Test Context Updated");
      assertEquals(body.time_windows.length, 1);

      // Verify old windows are removed
      const [{ count }] = await ctx.db`
        SELECT count(*)::int FROM todos.context_time_windows
        WHERE context_id = ${createdContextId}
      `;
      assertEquals(count, 1);
    });

    await t.step(
      "DELETE /api/contexts/:id removes context and windows",
      async () => {
        const res = await apiCall(
          ctx.app,
          "DELETE",
          `/api/contexts/${createdContextId}`,
        );

        assertEquals(res.status, 200);

        // Verify context is gone
        const contexts = await ctx
          .db`SELECT id FROM todos.contexts WHERE id = ${createdContextId}`;
        assertEquals(contexts.length, 0);

        // Verify windows cascaded
        const windows = await ctx
          .db`SELECT id FROM todos.context_time_windows WHERE context_id = ${createdContextId}`;
        assertEquals(windows.length, 0);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
