// Seed test — runs last to leave the database in a usable state for manual testing.
// Uses names that don't match cleanTestData patterns so they persist across test runs.

import { assertEquals } from "@std/assert";
import { apiCall, createTestDb, setupTestContext } from "./setup.ts";
import type { TestContext } from "./setup.ts";

let ctx: TestContext;

// Clean old seed data before inserting fresh
async function cleanSeedData() {
  const db = createTestDb();
  await db`DELETE FROM tasks.recurrence_rules WHERE task_id IN (SELECT id FROM tasks.tasks WHERE title LIKE 'Seed:%')`;
  await db`DELETE FROM tasks.task_history WHERE task_id IN (SELECT id FROM tasks.tasks WHERE title LIKE 'Seed:%')`;
  await db`DELETE FROM tasks.task_contexts WHERE task_id IN (SELECT id FROM tasks.tasks WHERE title LIKE 'Seed:%')`;
  await db`DELETE FROM tasks.tasks WHERE title LIKE 'Seed:%'`;
  await db`DELETE FROM tasks.saved_filters WHERE name LIKE 'Seed:%'`;
  await db`DELETE FROM tasks.project_contexts WHERE project_id IN (SELECT id FROM tasks.projects WHERE name LIKE 'Seed:%')`;
  await db`DELETE FROM tasks.context_time_windows WHERE context_id IN (SELECT id FROM tasks.contexts WHERE name LIKE 'Seed:%')`;
  await db`DELETE FROM tasks.contexts WHERE name LIKE 'Seed:%'`;
  await db`DELETE FROM tasks.projects WHERE name LIKE 'Seed:%'`;
  await db.end();
}

Deno.test("seed data for manual testing", async (t) => {
  ctx = await setupTestContext();
  await cleanSeedData();

  let morningContextId: string;
  let eveningContextId: string;
  let workProjectId: string;
  let homeProjectId: string;
  let errrandsProjectId: string;

  await t.step("create contexts", async () => {
    // Morning context: weekdays 6am-12pm
    const morningRes = await apiCall(ctx.app, "POST", "/api/contexts", {
      name: "Seed: Morning",
      color: "#FFB74D",
      timeWindows: [
        { dayOfWeek: 1, startTime: "06:00", endTime: "12:00" },
        { dayOfWeek: 2, startTime: "06:00", endTime: "12:00" },
        { dayOfWeek: 3, startTime: "06:00", endTime: "12:00" },
        { dayOfWeek: 4, startTime: "06:00", endTime: "12:00" },
        { dayOfWeek: 5, startTime: "06:00", endTime: "12:00" },
      ],
    });
    assertEquals(morningRes.status, 201);
    const morning = await morningRes.json();
    morningContextId = morning.id;

    // Evening context: every day 17:00-23:00
    const eveningRes = await apiCall(ctx.app, "POST", "/api/contexts", {
      name: "Seed: Evening",
      color: "#7986CB",
      timeWindows: [
        { dayOfWeek: 0, startTime: "17:00", endTime: "23:00" },
        { dayOfWeek: 1, startTime: "17:00", endTime: "23:00" },
        { dayOfWeek: 2, startTime: "17:00", endTime: "23:00" },
        { dayOfWeek: 3, startTime: "17:00", endTime: "23:00" },
        { dayOfWeek: 4, startTime: "17:00", endTime: "23:00" },
        { dayOfWeek: 5, startTime: "17:00", endTime: "23:00" },
        { dayOfWeek: 6, startTime: "17:00", endTime: "23:00" },
      ],
    });
    assertEquals(eveningRes.status, 201);
    const evening = await eveningRes.json();
    eveningContextId = evening.id;

    // Anytime context: no time windows (always active)
    const anytimeRes = await apiCall(ctx.app, "POST", "/api/contexts", {
      name: "Seed: Anytime",
      color: "#81C784",
      timeWindows: [],
    });
    assertEquals(anytimeRes.status, 201);
  });

  await t.step("create projects", async () => {
    const workRes = await apiCall(ctx.app, "POST", "/api/projects", {
      name: "Seed: Work",
      color: "#42A5F5",
      contextIds: [morningContextId],
    });
    assertEquals(workRes.status, 201);
    workProjectId = (await workRes.json()).id;

    const homeRes = await apiCall(ctx.app, "POST", "/api/projects", {
      name: "Seed: Home",
      color: "#AB47BC",
      contextIds: [eveningContextId],
    });
    assertEquals(homeRes.status, 201);
    homeProjectId = (await homeRes.json()).id;

    const errandsRes = await apiCall(ctx.app, "POST", "/api/projects", {
      name: "Seed: Errands",
      color: "#FFA726",
      contextIds: [morningContextId, eveningContextId],
    });
    assertEquals(errandsRes.status, 201);
    errrandsProjectId = (await errandsRes.json()).id;
  });

  await t.step("create tasks", async () => {
    // Work tasks (morning context via project)
    const workTasks = [
      { title: "Seed: Review pull requests", priority: 1 },
      { title: "Seed: Update project documentation", priority: 2 },
      { title: "Seed: Fix flaky test", priority: 1 },
      { title: "Seed: Plan sprint goals", priority: 3 },
    ];
    for (const task of workTasks) {
      const res = await apiCall(ctx.app, "POST", "/api/tasks", {
        ...task,
        projectId: workProjectId,
      });
      assertEquals(res.status, 201);
    }

    // Home tasks (evening context via project)
    const homeTasks = [
      { title: "Seed: Clean kitchen", priority: 2 },
      { title: "Seed: Organize bookshelf", priority: 3 },
      { title: "Seed: Fix leaky faucet", priority: 1 },
    ];
    for (const task of homeTasks) {
      const res = await apiCall(ctx.app, "POST", "/api/tasks", {
        ...task,
        projectId: homeProjectId,
      });
      assertEquals(res.status, 201);
    }

    // Errands tasks
    const errandTasks = [
      { title: "Seed: Buy groceries", priority: 1 },
      { title: "Seed: Return library books", priority: 2 },
    ];
    for (const task of errandTasks) {
      const res = await apiCall(ctx.app, "POST", "/api/tasks", {
        ...task,
        projectId: errrandsProjectId,
      });
      assertEquals(res.status, 201);
    }

    // Inbox tasks (no project, direct context)
    const inboxTasks = [
      {
        title: "Seed: Call dentist",
        priority: 1,
        contextIds: [morningContextId],
      },
      {
        title: "Seed: Read that article",
        priority: 3,
        contextIds: [eveningContextId],
      },
      { title: "Seed: Reply to email", priority: 2 },
    ];
    for (const task of inboxTasks) {
      const res = await apiCall(ctx.app, "POST", "/api/tasks", task);
      assertEquals(res.status, 201);
    }

    // Task with due date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dueRes = await apiCall(ctx.app, "POST", "/api/tasks", {
      title: "Seed: Submit report",
      priority: 1,
      projectId: workProjectId,
      dueDate: tomorrow.toISOString().split("T")[0],
    });
    assertEquals(dueRes.status, 201);

    // Deferred task
    const deferUntil = new Date();
    deferUntil.setDate(deferUntil.getDate() + 3);
    const deferredRes = await apiCall(ctx.app, "POST", "/api/tasks", {
      title: "Seed: Follow up on proposal",
      priority: 2,
      projectId: workProjectId,
    });
    assertEquals(deferredRes.status, 201);
    const deferred = await deferredRes.json();
    const deferRes = await apiCall(
      ctx.app,
      "POST",
      `/api/tasks/${deferred.id}/defer`,
      { until: deferUntil.toISOString() },
    );
    assertEquals(deferRes.status, 200);
  });

  await t.step("create filters", async () => {
    const highPriorityRes = await apiCall(ctx.app, "POST", "/api/filters", {
      name: "Seed: High Priority",
      color: "#EF5350",
      criteria: { priorities: [1] },
    });
    assertEquals(highPriorityRes.status, 201);

    const dueSoonRes = await apiCall(ctx.app, "POST", "/api/filters", {
      name: "Seed: Due This Week",
      color: "#FFA726",
      criteria: { dueDateWithin: { amount: 7, unit: "days" } },
    });
    assertEquals(dueSoonRes.status, 201);
  });

  await ctx.db.end();
});
