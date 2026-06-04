// Integration tests for Import API - advanced features
// Tests: context import with time windows, task import with recurrence, replace mode contexts

import { assertEquals } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Import Advanced Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    await t.step(
      "POST /api/import imports contexts with time windows",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
          contexts: [
            {
              name: "Test Context Import TW",
              time_windows: [
                { day_of_week: 1, start_time: "09:00", end_time: "17:00" },
                { day_of_week: 3, start_time: "10:00", end_time: "14:00" },
              ],
            },
          ],
        });
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.success, true);
        assertEquals(body.imported.contexts, 1);
      },
    );

    await t.step("merge mode skips duplicate contexts", async () => {
      const res = await apiCall(
        ctx.app,
        "POST",
        "/api/import?mode=merge&skipDuplicates=true",
        {
          contexts: [{ name: "Test Context Import TW" }],
        },
      );
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.skipped.contexts, 1);
    });

    await t.step(
      "POST /api/import imports tasks with recurrence rules",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
          tasks: [
            {
              title: "Integration Test Recurring Import",
              recurrence: {
                schedule_type: "fixed",
                frequency: "weekly",
                interval: 1,
                day_of_week: 1,
              },
            },
          ],
        });
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.success, true);
        assertEquals(body.imported.tasks, 1);
      },
    );

    await t.step(
      "POST /api/import imports tasks with project_id resolution via provided IDs",
      async () => {
        const projectId = "00000000-0000-4000-8000-000000000077";
        const res = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
          projects: [{ id: projectId, name: "Test Project Import Resolution" }],
          tasks: [
            {
              title: "Integration Test Task With Project Ref",
              project_id: projectId,
            },
          ],
        });
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.success, true);
        assertEquals(body.imported.projects, 1);
        assertEquals(body.imported.tasks, 1);
      },
    );

    await t.step("replace mode clears contexts and re-imports", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/import?mode=replace", {
        contexts: [
          {
            name: "Test Context Replace Fresh",
            time_windows: [
              { day_of_week: 5, start_time: "08:00", end_time: "12:00" },
            ],
          },
        ],
        projects: [{ name: "Test Project Replace Fresh" }],
        tasks: [{ title: "Integration Test Replace Fresh Task" }],
      });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.success, true);
      assertEquals(body.imported.contexts, 1);
      assertEquals(body.imported.projects, 1);
      assertEquals(body.imported.tasks, 1);
    });

    await t.step("POST /api/import with invalid body returns 400", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
        tasks: [{ title: 123 }], // title must be string
      });
      assertEquals(res.status, 400);
      const body = await res.json();
      assertEquals(body.error, "Invalid import data");
    });

    await t.step(
      "POST /api/import with context and no description",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
          contexts: [
            {
              name: "Test Context No Desc Import",
            },
          ],
        });
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.success, true);
        assertEquals(body.imported.contexts, 1);
      },
    );

    await t.step("POST /api/import with invalid mode returns 400", async () => {
      const res = await apiCall(
        ctx.app,
        "POST",
        "/api/import?mode=invalid_mode",
        { tasks: [{ title: "Should Not Import" }] },
      );
      assertEquals(res.status, 400);
      const body = await res.json();
      assertEquals(body.error, "Invalid options");
    });

    await t.step(
      "POST /api/import/tasks imports simple task list",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/import/tasks", {
          tasks: [
            { title: "Simple Import Task 1" },
            { title: "Simple Import Task 2", description: "With description" },
          ],
        });
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.success, true);
        assertEquals(body.imported, 2);
        assertEquals(body.failed, 0);
      },
    );

    await t.step(
      "POST /api/import/tasks with invalid body returns 400",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/import/tasks", {
          tasks: [{ not_title: "bad" }],
        });
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Invalid format");
      },
    );

    await t.step(
      "POST /api/import merge mode skips duplicate projects",
      async () => {
        // First import to create the project
        const res1 = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
          projects: [{ name: "Dedup Test Project" }],
        });
        assertEquals(res1.status, 200);
        const body1 = await res1.json();
        assertEquals(body1.imported.projects, 1);

        // Second import should skip
        const res = await apiCall(
          ctx.app,
          "POST",
          "/api/import?mode=merge&skipDuplicates=true",
          { projects: [{ name: "Dedup Test Project" }] },
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.skipped.projects, 1);
      },
    );

    // Clean up contexts created outside standard test cleanup patterns
    await ctx
      .db`DELETE FROM todos.context_time_windows WHERE context_id IN (SELECT id FROM todos.contexts WHERE name LIKE 'Test Context%')`;
    await ctx.db`DELETE FROM todos.contexts WHERE name LIKE 'Test Context%'`;
    await ctx
      .db`DELETE FROM todos.recurrence_rules WHERE task_id IN (SELECT id FROM todos.tasks WHERE title LIKE 'Integration Test%' OR title LIKE 'Simple Import%' OR title LIKE 'Dedup%')`;
    await ctx
      .db`DELETE FROM todos.tasks WHERE title LIKE 'Integration Test%' OR title LIKE 'Simple Import%' OR title LIKE 'Dedup%'`;
    await ctx
      .db`DELETE FROM todos.projects WHERE name LIKE 'Test Project%' OR name LIKE 'Dedup%'`;

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
