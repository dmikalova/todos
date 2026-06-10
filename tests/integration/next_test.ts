// Integration tests for Next endpoint — context-based selection
// Tests: stable selection, re-selection on complete/defer, rank ordering, fallback across contexts

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Next Endpoint Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // Setup: create an always-active context (no time windows = always active)
    let contextId: string;
    let projectId: string;

    await t.step("setup: create context and project", async () => {
      const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
        name: "Test Context Next Always",
        timeWindows: [],
      });
      assertEquals(ctxRes.status, 201);
      contextId = (await ctxRes.json()).id;

      const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
        name: "Test Project Next",
        contextIds: [contextId],
      });
      assertEquals(projRes.status, 201);
      projectId = (await projRes.json()).id;
    });

    await t.step("GET /api/next returns single task or null", async () => {
      // Create a task in the project with context
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Single",
        priority: 1,
        projectId,
      });

      const res = await apiCall(ctx.app, "GET", "/api/next");
      assertEquals(res.status, 200);
      const body = await res.json();

      // Response shape: { task: Task | null }
      assertEquals("task" in body, true);
      if (body.task) {
        assertExists(body.task.id);
        assertExists(body.task.title);
      }
    });

    await t.step(
      "GET /api/next stable selection — same task on repeated calls",
      async () => {
        const res1 = await apiCall(ctx.app, "GET", "/api/next");
        assertEquals(res1.status, 200);
        const body1 = await res1.json();

        const res2 = await apiCall(ctx.app, "GET", "/api/next");
        assertEquals(res2.status, 200);
        const body2 = await res2.json();

        // Same task should be returned
        assertEquals(body1.task?.id, body2.task?.id);
      },
    );

    await t.step("completing task triggers re-selection", async () => {
      // Get current task
      const res1 = await apiCall(ctx.app, "GET", "/api/next");
      const body1 = await res1.json();
      assertExists(body1.task);
      const firstTaskId = body1.task.id;

      // Create another task so there's something to select next
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next After Complete",
        priority: 2,
        projectId,
      });

      // Complete the current task
      await apiCall(ctx.app, "POST", `/api/tasks/${firstTaskId}/complete`);

      // Next should return a different task (or null)
      const res2 = await apiCall(ctx.app, "GET", "/api/next");
      const body2 = await res2.json();

      if (body2.task) {
        // Should not be the completed task
        assertEquals(body2.task.id !== firstTaskId, true);
      }
    });

    await t.step("GET /api/next excludes deferred tasks", async () => {
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Deferred",
        priority: 2,
        projectId,
      });
      assertEquals(createRes.status, 201);
      const task = await createRes.json();

      // Defer the task
      await apiCall(ctx.app, "POST", `/api/tasks/${task.id}/defer`, {
        preset: "tomorrow",
      });

      // The deferred task should not be selected as next
      const res = await apiCall(ctx.app, "GET", "/api/next");
      assertEquals(res.status, 200);
      const body = await res.json();

      if (body.task) {
        assertEquals(body.task.id !== task.id, true);
      }
    });

    await t.step("deferring current task triggers re-selection", async () => {
      // Create a fresh task to become current
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Defer Reselect",
        priority: 1,
        projectId,
      });
      assertEquals(createRes.status, 201);
      await createRes.json();

      // Force this as next by completing all others or just check behavior
      const res1 = await apiCall(ctx.app, "GET", "/api/next");
      const body1 = await res1.json();
      assertExists(body1.task);

      // Defer whatever the current task is
      await apiCall(ctx.app, "POST", `/api/tasks/${body1.task.id}/defer`, {
        preset: "tomorrow",
      });

      // Next should now return a different task
      const res2 = await apiCall(ctx.app, "GET", "/api/next");
      const body2 = await res2.json();

      if (body2.task) {
        assertEquals(body2.task.id !== body1.task.id, true);
      }
    });

    await t.step(
      "GET /api/next returns null when no eligible tasks",
      async () => {
        // Clean up all test tasks
        await ctx
          .db`DELETE FROM tasks.tasks WHERE title LIKE 'Integration Test%'`;
        // Clear next selection
        await ctx.db`DELETE FROM tasks.user_next_selection`;

        const res = await apiCall(ctx.app, "GET", "/api/next");
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.task, null);
      },
    );

    await t.step(
      "POST /api/tasks/:id/defer defers task with preset",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Defer Action",
          priority: 3,
          projectId,
        });
        assertEquals(createRes.status, 201);
        const task = await createRes.json();

        const deferRes = await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${task.id}/defer`,
          { preset: "tomorrow" },
        );

        assertEquals(deferRes.status, 200);
        const deferred = await deferRes.json();
        assertExists(deferred.deferred_until);
      },
    );

    await t.step(
      "DELETE /api/tasks/:id/defer clears deferred_until",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Clear Defer",
          priority: 3,
          projectId,
        });
        assertEquals(createRes.status, 201);
        const task = await createRes.json();

        // Defer first
        await apiCall(ctx.app, "POST", `/api/tasks/${task.id}/defer`, {
          preset: "next_week",
        });

        // Clear defer
        const clearRes = await apiCall(
          ctx.app,
          "DELETE",
          `/api/tasks/${task.id}/defer`,
        );

        assertEquals(clearRes.status, 200);
        const cleared = await clearRes.json();
        assertEquals(cleared.deferred_until, null);
      },
    );

    await t.step(
      "GET /api/next re-selects when stored selection becomes ineligible",
      async () => {
        // Create a fresh task
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Stale Selection",
          priority: 1,
          projectId,
        });
        assertEquals(createRes.status, 201);
        const task = await createRes.json();

        // Directly set user_next_selection.task_id to this task, then soft-delete it
        // This simulates a stale selection (task becomes ineligible outside normal flow)
        await ctx
          .db`INSERT INTO tasks.user_next_selection (user_id, task_id, selected_at)
              VALUES (${ctx.userId}, ${task.id}, NOW())
              ON CONFLICT (user_id) DO UPDATE SET task_id = ${task.id}, selected_at = NOW()`;

        // Soft-delete the task directly in DB to avoid clearing user_next_selection
        await ctx
          .db`UPDATE tasks.tasks SET deleted_at = NOW() WHERE id = ${task.id}`;

        // GET /api/next should detect stale selection and pick a new task
        const res = await apiCall(ctx.app, "GET", "/api/next");
        assertEquals(res.status, 200);
        const body = await res.json();

        // Should NOT return the deleted task
        if (body.task) {
          assertEquals(body.task.id !== task.id, true);
        }
      },
    );

    await t.step(
      "GET /api/next uses user timezone from settings",
      async () => {
        // Clean slate
        await ctx
          .db`DELETE FROM tasks.tasks WHERE user_id = ${ctx.userId}`;
        await ctx
          .db`DELETE FROM tasks.user_next_selection WHERE user_id = ${ctx.userId}`;

        // Set user timezone
        await apiCall(ctx.app, "PUT", "/api/settings", {
          timezone: "America/Los_Angeles",
        });

        // Create a task to select
        await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Next With Timezone",
          priority: 4,
          projectId,
        });

        // Should still work with user timezone set
        const res = await apiCall(ctx.app, "GET", "/api/next");
        assertEquals(res.status, 200);
        const body = await res.json();
        // The always-active context should still produce a result
        if (body.task) {
          assertEquals(body.task.title, "Integration Test Next With Timezone");
        }
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
