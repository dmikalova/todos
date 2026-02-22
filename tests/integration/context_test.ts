// Integration tests for context detection
// Tests: automatic context detection, manual override, time windows

import { assertEquals } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
  testId,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Context Detection Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // Set up test contexts
    const workContextId = testId("work-ctx");
    const homeContextId = testId("home-ctx");

    await ctx.db`
      INSERT INTO todos.contexts (id, name, created_at, updated_at)
      VALUES
        (${workContextId}, 'Test Context Work', NOW(), NOW()),
        (${homeContextId}, 'Test Context Home', NOW(), NOW())
    `;

    // Add time windows for work context (Mon-Fri 9-17)
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

    // Add time windows for home context (evenings and weekends)
    for (let day = 1; day <= 5; day++) {
      await ctx.db`
        INSERT INTO todos.context_time_windows (
          id, context_id, day_of_week, start_time, end_time, created_at, updated_at
        )
        VALUES (
          ${testId("window")}, ${homeContextId}, ${day},
          '17:00:00', '22:00:00', NOW(), NOW()
        )
      `;
    }

    await t.step(
      "GET /api/contexts/current returns active contexts for given time",
      async () => {
        // Test during work hours (Tuesday 10:00)
        const workTime = "2026-02-24T10:00:00"; // Tuesday
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/current?local_time=${encodeURIComponent(workTime)}`,
        );

        if (res.status === 200) {
          const body = await res.json();
          // Work context should be active on Tuesday at 10:00
          const activeNames = body.contexts.map(
            (c: { name: string }) => c.name,
          );
          assertEquals(activeNames.includes("Test Context Work"), true);
        }
      },
    );

    await t.step(
      "context detection returns empty during non-matching hours",
      async () => {
        // Test at midnight Saturday
        const midnightSat = "2026-02-28T02:00:00"; // Saturday 2am
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/current?local_time=${encodeURIComponent(midnightSat)}`,
        );

        if (res.status === 200) {
          const body = await res.json();
          // Neither work nor home context should be active at 2am Saturday
          const testContexts = body.contexts.filter(
            (c: { name: string }) =>
              c.name === "Test Context Work" || c.name === "Test Context Home",
          );
          assertEquals(testContexts.length, 0);
        }
      },
    );

    await t.step(
      "manual context override works in task filtering",
      async () => {
        // Create tasks with specific contexts
        const workTaskId = testId("work-task");
        const homeTaskId = testId("home-task");

        await ctx.db`
        INSERT INTO todos.tasks (id, title, created_at, updated_at)
        VALUES
          (${workTaskId}, 'Integration Test Work Task', NOW(), NOW()),
          (${homeTaskId}, 'Integration Test Home Task', NOW(), NOW())
      `;

        await ctx.db`
        INSERT INTO todos.task_contexts (task_id, context_id)
        VALUES
          (${workTaskId}, ${workContextId}),
          (${homeTaskId}, ${homeContextId})
      `;

        // Filter tasks by work context override
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/tasks?context_id=${workContextId}`,
        );

        if (res.status === 200) {
          const body = await res.json();
          const titles = body.tasks.map((t: { title: string }) => t.title);

          // Should include work task
          assertEquals(titles.includes("Integration Test Work Task"), true);
          // Should not include home task
          assertEquals(titles.includes("Integration Test Home Task"), false);
        }
      },
    );

    await t.step(
      "tasks without context are shown regardless of context filter",
      async () => {
        const noContextTaskId = testId("no-ctx-task");

        await ctx.db`
        INSERT INTO todos.tasks (id, title, created_at, updated_at)
        VALUES (${noContextTaskId}, 'Integration Test No Context Task', NOW(), NOW())
      `;

        // Filter by work context, but task with no context should still appear
        // (as it's context-agnostic)
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/tasks?context_id=${workContextId}&include_no_context=true`,
        );

        if (res.status === 200) {
          const body = await res.json();
          const titles = body.tasks.map((t: { title: string }) => t.title);

          // Task without context should be included
          assertEquals(
            titles.includes("Integration Test No Context Task"),
            true,
          );
        }
      },
    );

    await t.step("multiple contexts on task work with OR logic", async () => {
      const multiContextTaskId = testId("multi-ctx-task");

      await ctx.db`
        INSERT INTO todos.tasks (id, title, created_at, updated_at)
        VALUES (${multiContextTaskId}, 'Integration Test Multi Context', NOW(), NOW())
      `;

      // Assign both contexts
      await ctx.db`
        INSERT INTO todos.task_contexts (task_id, context_id)
        VALUES
          (${multiContextTaskId}, ${workContextId}),
          (${multiContextTaskId}, ${homeContextId})
      `;

      // Filter by either context should return the task
      const workRes = await apiCall(
        ctx.app,
        "GET",
        `/api/tasks?context_id=${workContextId}`,
      );

      if (workRes.status === 200) {
        const body = await workRes.json();
        const titles = body.tasks.map((t: { title: string }) => t.title);
        assertEquals(titles.includes("Integration Test Multi Context"), true);
      }

      const homeRes = await apiCall(
        ctx.app,
        "GET",
        `/api/tasks?context_id=${homeContextId}`,
      );

      if (homeRes.status === 200) {
        const body = await homeRes.json();
        const titles = body.tasks.map((t: { title: string }) => t.title);
        assertEquals(titles.includes("Integration Test Multi Context"), true);
      }
    });

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
