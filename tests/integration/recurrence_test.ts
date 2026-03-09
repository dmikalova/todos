// Integration tests for recurrence CRUD and completion flow

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Recurrence CRUD Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // -----------------------------------------------------------------------
    // CREATE recurrence rules via API
    // -----------------------------------------------------------------------

    await t.step("create daily recurrence via API", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Daily Recurrence",
        priority: 3,
      });
      assertEquals(taskRes.status, 201);
      const task = await taskRes.json();

      const res = await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "daily",
        interval: 1,
      });
      assertEquals(res.status, 201);
      const rule = await res.json();
      assertEquals(rule.schedule_type, "fixed");
      assertEquals(rule.frequency, "daily");
      assertEquals(rule.interval, 1);
    });

    await t.step("create weekly recurrence via API", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Weekly Recurrence",
        priority: 3,
      });
      assertEquals(taskRes.status, 201);
      const task = await taskRes.json();

      const res = await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "weekly",
        interval: 1,
        daysOfWeek: [1, 3, 5],
      });
      assertEquals(res.status, 201);
      const rule = await res.json();
      assertEquals(rule.schedule_type, "fixed");
      assertEquals(rule.frequency, "weekly");
      assertEquals(rule.interval, 1);
      assertEquals(rule.days_of_week, [1, 3, 5]);
    });

    await t.step("create monthly recurrence via API", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Monthly Recurrence",
        priority: 3,
      });
      assertEquals(taskRes.status, 201);
      const task = await taskRes.json();

      const res = await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "monthly",
        interval: 1,
        dayOfMonth: 15,
      });
      assertEquals(res.status, 201);
      const rule = await res.json();
      assertEquals(rule.frequency, "monthly");
      assertEquals(rule.day_of_month, 15);
    });

    await t.step("create yearly recurrence via API", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Yearly Recurrence",
        priority: 3,
      });
      assertEquals(taskRes.status, 201);
      const task = await taskRes.json();

      const res = await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "yearly",
        interval: 1,
        monthOfYear: 12,
        dayOfMonth: 25,
      });
      assertEquals(res.status, 201);
      const rule = await res.json();
      assertEquals(rule.frequency, "yearly");
      assertEquals(rule.month_of_year, 12);
      assertEquals(rule.day_of_month, 25);
    });

    await t.step("create completion-based recurrence via API", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Completion Recurrence",
        priority: 3,
      });
      assertEquals(taskRes.status, 201);
      const task = await taskRes.json();

      const res = await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "completion",
        daysAfterCompletion: 7,
      });
      assertEquals(res.status, 201);
      const rule = await res.json();
      assertEquals(rule.schedule_type, "completion");
      assertEquals(rule.days_after_completion, 7);
    });

    // -----------------------------------------------------------------------
    // READ recurrence rules via API
    // -----------------------------------------------------------------------

    await t.step("read recurrence rule via GET", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Read Recurrence",
        priority: 3,
      });
      const task = await taskRes.json();

      await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "weekly",
        interval: 2,
        daysOfWeek: [0, 6],
      });

      const res = await apiCall(ctx.app, "GET", `/api/recurrence/${task.id}`);
      assertEquals(res.status, 200);
      const rule = await res.json();
      assertEquals(rule.frequency, "weekly");
      assertEquals(rule.interval, 2);
      assertEquals(rule.days_of_week, [0, 6]);
    });

    await t.step("GET returns 404 for task without recurrence", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test No Rule",
        priority: 3,
      });
      const task = await taskRes.json();

      const res = await apiCall(ctx.app, "GET", `/api/recurrence/${task.id}`);
      assertEquals(res.status, 404);
    });

    // -----------------------------------------------------------------------
    // Task list includes recurrence data
    // -----------------------------------------------------------------------

    await t.step("task list includes recurrence data", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Task With Recurrence Data",
        priority: 2,
      });
      const task = await taskRes.json();

      await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "weekly",
        interval: 1,
        daysOfWeek: [1, 3],
      });

      // Fetch task by ID
      const getRes = await apiCall(ctx.app, "GET", `/api/tasks/${task.id}`);
      assertEquals(getRes.status, 200);
      const fetched = await getRes.json();
      assertEquals(fetched.recurrence_type, "weekly");
      assertEquals(fetched.recurrence_interval, 1);
      assertEquals(fetched.recurrence_days, [1, 3]);
    });

    await t.step(
      "task without recurrence has null recurrence fields",
      async () => {
        const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Task No Recurrence Data",
          priority: 2,
        });
        const task = await taskRes.json();

        const getRes = await apiCall(ctx.app, "GET", `/api/tasks/${task.id}`);
        assertEquals(getRes.status, 200);
        const fetched = await getRes.json();
        assertEquals(fetched.recurrence_type, null);
        assertEquals(fetched.recurrence_interval, null);
        assertEquals(fetched.recurrence_days, null);
      },
    );

    // -----------------------------------------------------------------------
    // UPDATE recurrence rules via API
    // -----------------------------------------------------------------------

    await t.step("update recurrence frequency via PATCH", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Update Recurrence",
        priority: 3,
      });
      const task = await taskRes.json();

      await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "daily",
        interval: 1,
      });

      const res = await apiCall(
        ctx.app,
        "PATCH",
        `/api/recurrence/${task.id}`,
        { frequency: "weekly", daysOfWeek: [1, 5] },
      );
      assertEquals(res.status, 200);
      const updated = await res.json();
      assertEquals(updated.frequency, "weekly");
      assertEquals(updated.days_of_week, [1, 5]);
    });

    // -----------------------------------------------------------------------
    // DELETE recurrence rules via API
    // -----------------------------------------------------------------------

    await t.step("delete recurrence rule", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Delete Recurrence",
        priority: 3,
      });
      const task = await taskRes.json();

      await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "daily",
        interval: 1,
      });

      const res = await apiCall(
        ctx.app,
        "DELETE",
        `/api/recurrence/${task.id}`,
      );
      assertEquals(res.status, 200);

      // Verify it's gone
      const getRes = await apiCall(
        ctx.app,
        "GET",
        `/api/recurrence/${task.id}`,
      );
      assertEquals(getRes.status, 404);
    });

    // -----------------------------------------------------------------------
    // Completion flow tests
    // -----------------------------------------------------------------------

    await t.step(
      "completing daily recurring task creates next occurrence",
      async () => {
        const today = new Date().toISOString().split("T")[0];
        const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Daily Complete",
          priority: 3,
          dueDate: today,
        });
        assertEquals(taskRes.status, 201);
        const task = await taskRes.json();

        await apiCall(ctx.app, "POST", "/api/recurrence", {
          taskId: task.id,
          scheduleType: "fixed",
          frequency: "daily",
          interval: 1,
        });

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
          WHERE title = 'Integration Test Daily Complete'
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

        const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Weekly Complete",
          priority: 3,
          dueDate: today.toISOString().split("T")[0],
        });
        assertEquals(taskRes.status, 201);
        const task = await taskRes.json();

        await apiCall(ctx.app, "POST", "/api/recurrence", {
          taskId: task.id,
          scheduleType: "fixed",
          frequency: "weekly",
          interval: 1,
          daysOfWeek: [dayOfWeek],
        });

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${task.id}/complete`,
        );
        assertEquals(res.status, 200);

        const [nextTask] = await ctx.db`
          SELECT id, due_date
          FROM todos.tasks
          WHERE title = 'Integration Test Weekly Complete'
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
        const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Completion Complete",
          priority: 3,
        });
        assertEquals(taskRes.status, 201);
        const task = await taskRes.json();

        await apiCall(ctx.app, "POST", "/api/recurrence", {
          taskId: task.id,
          scheduleType: "completion",
          daysAfterCompletion: 7,
        });

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${task.id}/complete`,
        );
        assertEquals(res.status, 200);

        const [nextTask] = await ctx.db`
          SELECT id, due_date
          FROM todos.tasks
          WHERE title = 'Integration Test Completion Complete'
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
        const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test No Recurrence Complete",
          priority: 3,
        });
        assertEquals(taskRes.status, 201);
        const task = await taskRes.json();

        await apiCall(ctx.app, "POST", `/api/tasks/${task.id}/complete`);

        const [{ count }] = await ctx.db`
          SELECT COUNT(*)::int as count
          FROM todos.tasks
          WHERE title = 'Integration Test No Recurrence Complete'
        `;
        assertEquals(count, 1);
      },
    );

    // -----------------------------------------------------------------------
    // Validation tests
    // -----------------------------------------------------------------------

    await t.step("reject duplicate recurrence rule", async () => {
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Duplicate Rule",
        priority: 3,
      });
      const task = await taskRes.json();

      const first = await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "daily",
        interval: 1,
      });
      assertEquals(first.status, 201);

      const second = await apiCall(ctx.app, "POST", "/api/recurrence", {
        taskId: task.id,
        scheduleType: "fixed",
        frequency: "weekly",
        interval: 1,
      });
      assertEquals(second.status, 400);
    });

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
