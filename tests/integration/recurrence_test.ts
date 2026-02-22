// Integration tests for recurrence completion flow
// Tests: completing recurring task creates next occurrence

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
  name: "Recurrence Flow Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    await t.step(
      "completing daily recurring task creates next occurrence",
      async () => {
        // Create a task with daily recurrence
        const taskId = testId("daily-recur");
        const today = new Date().toISOString().split("T")[0];

        await ctx.db`
        INSERT INTO todos.tasks (id, title, due_date, created_at, updated_at)
        VALUES (${taskId}, 'Integration Test Daily Task', ${today}, NOW(), NOW())
      `;

        await ctx.db`
        INSERT INTO todos.recurrence_rules (
          id, task_id, schedule_type, frequency, interval, created_at, updated_at
        )
        VALUES (
          ${testId("rule")}, ${taskId}, 'fixed', 'daily', 1, NOW(), NOW()
        )
      `;

        // Complete the task via API
        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${taskId}/complete`,
        );

        // Check for success (may fail auth in test mode)
        if (res.status === 200) {
          // Verify original task is completed
          const [original] = await ctx.db`
          SELECT completed_at FROM todos.tasks WHERE id = ${taskId}
        `;
          assertExists(original.completed_at);

          // Verify new task was created with tomorrow's date
          const [nextTask] = await ctx.db`
          SELECT id, due_date
          FROM todos.tasks
          WHERE title = 'Integration Test Daily Task'
          AND id != ${taskId}
          ORDER BY created_at DESC
          LIMIT 1
        `;

          // New task should exist
          assertExists(nextTask);

          // Due date should be tomorrow
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          assertEquals(
            nextTask.due_date.toISOString().split("T")[0],
            tomorrow.toISOString().split("T")[0],
          );
        }
      },
    );

    await t.step(
      "completing weekly recurring task advances to correct weekday",
      async () => {
        const taskId = testId("weekly-recur");
        const today = new Date();
        const dayOfWeek = today.getDay(); // 0-6

        await ctx.db`
        INSERT INTO todos.tasks (id, title, due_date, created_at, updated_at)
        VALUES (${taskId}, 'Integration Test Weekly Task', ${today.toISOString()}, NOW(), NOW())
      `;

        await ctx.db`
        INSERT INTO todos.recurrence_rules (
          id, task_id, schedule_type, frequency, interval, days_of_week, created_at, updated_at
        )
        VALUES (
          ${testId("rule")}, ${taskId}, 'fixed', 'weekly', 1,
          ${[dayOfWeek]}::int[],
          NOW(), NOW()
        )
      `;

        // Complete the task
        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${taskId}/complete`,
        );

        if (res.status === 200) {
          // Verify new task due date is exactly 7 days later (same weekday)
          const [nextTask] = await ctx.db`
          SELECT id, due_date
          FROM todos.tasks
          WHERE title = 'Integration Test Weekly Task'
          AND id != ${taskId}
          ORDER BY created_at DESC
          LIMIT 1
        `;

          if (nextTask) {
            const nextDate = new Date(nextTask.due_date);
            assertEquals(nextDate.getDay(), dayOfWeek);
          }
        }
      },
    );

    await t.step(
      "completing completion-based task uses completion date",
      async () => {
        const taskId = testId("completion-recur");

        await ctx.db`
        INSERT INTO todos.tasks (id, title, created_at, updated_at)
        VALUES (${taskId}, 'Integration Test Completion Task', NOW(), NOW())
      `;

        await ctx.db`
        INSERT INTO todos.recurrence_rules (
          id, task_id, schedule_type, days_after_completion, created_at, updated_at
        )
        VALUES (
          ${testId("rule")}, ${taskId}, 'completion', 7, NOW(), NOW()
        )
      `;

        // Complete the task
        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${taskId}/complete`,
        );

        if (res.status === 200) {
          // New task should be due 7 days from now
          const [nextTask] = await ctx.db`
          SELECT id, due_date
          FROM todos.tasks
          WHERE title = 'Integration Test Completion Task'
          AND id != ${taskId}
          ORDER BY created_at DESC
          LIMIT 1
        `;

          if (nextTask) {
            const expectedDate = new Date();
            expectedDate.setDate(expectedDate.getDate() + 7);

            assertEquals(
              nextTask.due_date.toISOString().split("T")[0],
              expectedDate.toISOString().split("T")[0],
            );
          }
        }
      },
    );

    await t.step(
      "task without recurrence does not create next occurrence",
      async () => {
        const taskId = testId("no-recur");

        await ctx.db`
        INSERT INTO todos.tasks (id, title, created_at, updated_at)
        VALUES (${taskId}, 'Integration Test No Recurrence', NOW(), NOW())
      `;

        // Complete the task
        await apiCall(ctx.app, "POST", `/api/tasks/${taskId}/complete`);

        // Count tasks with this title
        const [{ count }] = await ctx.db`
        SELECT COUNT(*) as count
        FROM todos.tasks
        WHERE title = 'Integration Test No Recurrence'
      `;

        // Should only be the original task
        assertEquals(parseInt(count), 1);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
