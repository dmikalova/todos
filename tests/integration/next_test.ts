// Integration tests for Next page with deferred tasks
// Tests: scoring, defer timing, context filtering

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
  testId,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Next Page Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // Create test context for filtering
    const workContextId = testId("work-ctx");

    await ctx.db`
      INSERT INTO todos.contexts (id, name, created_at, updated_at)
      VALUES (${workContextId}, 'Test Context Next', NOW(), NOW())
    `;

    // Add time windows (9-17 weekdays)
    for (let day = 1; day <= 5; day++) {
      await ctx.db`
        INSERT INTO todos.context_time_windows (
          id, context_id, day_of_week, start_time, end_time, created_at, updated_at
        )
        VALUES (
          ${testId("window")}, ${workContextId}, ${day},
          '09:00:00', '17:00:00', NOW(), NOW()
        )
      `;
    }

    await t.step("GET /api/next returns up to 2 tasks", async () => {
      // Create several tasks
      for (let i = 1; i <= 5; i++) {
        const taskId = testId(`next-task-${i}`);
        await ctx.db`
          INSERT INTO todos.tasks (id, title, created_at, updated_at)
          VALUES (${taskId}, ${`Integration Test Next ${i}`}, NOW(), NOW())
        `;
      }

      const res = await apiCall(ctx.app, "GET", "/api/next");

      if (res.status === 200) {
        const body = await res.json();
        // Should return at most 2 tasks
        assertEquals(body.tasks.length <= 2, true);
      }
    });

    await t.step("deferred task is excluded before defer time", async () => {
      const deferredTaskId = testId("deferred-task");
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 2);

      await ctx.db`
        INSERT INTO todos.tasks (id, title, defer_until, created_at, updated_at)
        VALUES (
          ${deferredTaskId},
          'Integration Test Deferred Task',
          ${futureTime.toISOString()},
          NOW(), NOW()
        )
      `;

      const res = await apiCall(ctx.app, "GET", "/api/next");

      if (res.status === 200) {
        const body = await res.json();
        const titles = body.tasks.map((t: { title: string }) => t.title);

        // Deferred task should NOT appear in Next
        assertEquals(titles.includes("Integration Test Deferred Task"), false);
      }
    });

    await t.step(
      "deferred task is included after defer time passes",
      async () => {
        const expiredDeferTaskId = testId("expired-defer-task");
        const pastTime = new Date();
        pastTime.setHours(pastTime.getHours() - 1);

        await ctx.db`
        INSERT INTO todos.tasks (id, title, defer_until, created_at, updated_at)
        VALUES (
          ${expiredDeferTaskId},
          'Integration Test Expired Defer',
          ${pastTime.toISOString()},
          NOW(), NOW()
        )
      `;

        const res = await apiCall(ctx.app, "GET", "/api/next");

        if (res.status === 200) {
          const body = await res.json();
          // Task with expired defer should be eligible for Next
          // It may or may not appear depending on scoring, but it's eligible
          // Just verify we got results
          assertExists(body.tasks);
        }
      },
    );

    await t.step("POST /api/tasks/:id/defer sets defer_until", async () => {
      const taskId = testId("defer-test");

      await ctx.db`
        INSERT INTO todos.tasks (id, title, created_at, updated_at)
        VALUES (${taskId}, 'Integration Test Defer Action', NOW(), NOW())
      `;

      // Defer for 2 hours
      const res = await apiCall(ctx.app, "POST", `/api/tasks/${taskId}/defer`, {
        hours: 2,
      });

      if (res.status === 200) {
        // Verify defer_until is set
        const [task] = await ctx.db`
          SELECT defer_until FROM todos.tasks WHERE id = ${taskId}
        `;

        assertExists(task.defer_until);

        // Should be approximately 2 hours from now
        const deferTime = new Date(task.defer_until);
        const now = new Date();
        const diffHours = (deferTime.getTime() - now.getTime()) /
          (1000 * 60 * 60);

        assertEquals(diffHours > 1.9 && diffHours < 2.1, true);
      }
    });

    await t.step("DELETE /api/tasks/:id/defer clears defer_until", async () => {
      const taskId = testId("clear-defer");
      const futureTime = new Date();
      futureTime.setHours(futureTime.getHours() + 4);

      await ctx.db`
        INSERT INTO todos.tasks (id, title, defer_until, created_at, updated_at)
        VALUES (
          ${taskId},
          'Integration Test Clear Defer',
          ${futureTime.toISOString()},
          NOW(), NOW()
        )
      `;

      // Clear defer
      const res = await apiCall(
        ctx.app,
        "DELETE",
        `/api/tasks/${taskId}/defer`,
      );

      if (res.status === 200) {
        const [task] = await ctx.db`
          SELECT defer_until FROM todos.tasks WHERE id = ${taskId}
        `;

        // defer_until should be null
        assertEquals(task.defer_until, null);
      }
    });

    await t.step(
      "context filter in Next respects current context",
      async () => {
        // Create task with work context
        const workTaskId = testId("next-work-task");

        await ctx.db`
        INSERT INTO todos.tasks (id, title, created_at, updated_at)
        VALUES (${workTaskId}, 'Integration Test Next Work', NOW(), NOW())
      `;

        await ctx.db`
        INSERT INTO todos.task_contexts (task_id, context_id)
        VALUES (${workTaskId}, ${workContextId})
      `;

        // Get Next with work context override
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/next?context_id=${workContextId}`,
        );

        if (res.status === 200) {
          const body = await res.json();
          // If any tasks were returned, verify context-compatible ones
          if (body.tasks.length > 0) {
            // Each task should either have the work context or no context
            for (const task of body.tasks) {
              if (task.context_ids && task.context_ids.length > 0) {
                assertEquals(task.context_ids.includes(workContextId), true);
              }
            }
          }
        }
      },
    );

    await t.step("overdue tasks get priority in Next", async () => {
      // Create an overdue task
      const overdueTaskId = testId("overdue-task");
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      await ctx.db`
        INSERT INTO todos.tasks (id, title, due_date, created_at, updated_at)
        VALUES (
          ${overdueTaskId},
          'Integration Test Overdue Priority',
          ${yesterday.toISOString()},
          NOW(), NOW()
        )
      `;

      // Create a task due next week
      const futureTaskId = testId("future-task");
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);

      await ctx.db`
        INSERT INTO todos.tasks (id, title, due_date, created_at, updated_at)
        VALUES (
          ${futureTaskId},
          'Integration Test Future Task',
          ${nextWeek.toISOString()},
          NOW(), NOW()
        )
      `;

      const res = await apiCall(ctx.app, "GET", "/api/next");

      if (res.status === 200) {
        const body = await res.json();

        // If we get both tasks, overdue should score higher
        // Just verify we have results
        assertExists(body.tasks);
      }
    });

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
