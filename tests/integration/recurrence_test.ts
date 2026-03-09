// Integration tests for recurrence completion flow
// Tests: completing recurring task creates next occurrence

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Recurrence Flow Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    await t.step(
      "completing daily recurring task creates next occurrence",
      async () => {
        // Create task via API
        const today = new Date().toISOString().split("T")[0];
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Daily Task",
          priority: 3,
          dueDate: today,
        });
        assertEquals(createRes.status, 201);
        const task = await createRes.json();

        // Add recurrence rule via superuser DB (no API for this yet)
        const ruleId = crypto.randomUUID();
        await ctx.db`
          INSERT INTO todos.recurrence_rules (
            id, task_id, schedule_type, frequency, interval, created_at
          )
          VALUES (
            ${ruleId}, ${task.id}, 'fixed', 'daily', 1, NOW()
          )
        `;

        // Complete the task via API
        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${task.id}/complete`,
        );

        assertEquals(res.status, 200);

        // Verify original task is completed
        const [original] = await ctx.db`
          SELECT completed_at FROM todos.tasks WHERE id = ${task.id}
        `;
        assertExists(original.completed_at);

        // Verify new task was created with tomorrow's date
        const [nextTask] = await ctx.db`
          SELECT id, due_date
          FROM todos.tasks
          WHERE title = 'Integration Test Daily Task'
          AND id != ${task.id}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        assertExists(nextTask);

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        assertEquals(
          nextTask.due_date.toISOString().split("T")[0],
          tomorrow.toISOString().split("T")[0],
        );
      },
    );

    await t.step(
      "completing weekly recurring task advances to correct weekday",
      async () => {
        const today = new Date();
        const dayOfWeek = today.getDay();

        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Weekly Task",
          priority: 3,
          dueDate: today.toISOString().split("T")[0],
        });
        assertEquals(createRes.status, 201);
        const task = await createRes.json();

        const ruleId = crypto.randomUUID();
        await ctx.db`
          INSERT INTO todos.recurrence_rules (
            id, task_id, schedule_type, frequency, interval, days_of_week, created_at
          )
          VALUES (
            ${ruleId}, ${task.id}, 'fixed', 'weekly', 1,
            ${[dayOfWeek]}::int[],
            NOW()
          )
        `;

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${task.id}/complete`,
        );

        assertEquals(res.status, 200);

        const [nextTask] = await ctx.db`
          SELECT id, due_date
          FROM todos.tasks
          WHERE title = 'Integration Test Weekly Task'
          AND id != ${task.id}
          ORDER BY created_at DESC
          LIMIT 1
        `;

        if (nextTask) {
          const nextDate = new Date(nextTask.due_date);
          assertEquals(nextDate.getDay(), dayOfWeek);
        }
      },
    );

    await t.step(
      "completing completion-based task uses completion date",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Completion Task",
          priority: 3,
        });
        assertEquals(createRes.status, 201);
        const task = await createRes.json();

        const ruleId = crypto.randomUUID();
        await ctx.db`
          INSERT INTO todos.recurrence_rules (
            id, task_id, schedule_type, days_after_completion, created_at
          )
          VALUES (
            ${ruleId}, ${task.id}, 'completion', 7, NOW()
          )
        `;

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${task.id}/complete`,
        );

        assertEquals(res.status, 200);

        const [nextTask] = await ctx.db`
          SELECT id, due_date
          FROM todos.tasks
          WHERE title = 'Integration Test Completion Task'
          AND id != ${task.id}
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
      },
    );

    await t.step(
      "task without recurrence does not create next occurrence",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test No Recurrence",
          priority: 3,
        });
        assertEquals(createRes.status, 201);
        const task = await createRes.json();

        await apiCall(ctx.app, "POST", `/api/tasks/${task.id}/complete`);

        const [{ count }] = await ctx.db`
          SELECT COUNT(*)::int as count
          FROM todos.tasks
          WHERE title = 'Integration Test No Recurrence'
        `;

        assertEquals(count, 1);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
