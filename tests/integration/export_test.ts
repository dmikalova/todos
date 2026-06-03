// Integration tests for Export API
// Tests: full export JSON/CSV, task/project/context export, CSV escaping, filters

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Export Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    let projectId: string;
    let contextId: string;

    await t.step("setup: create context, project, tasks", async () => {
      const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
        name: "Test Context Export",
        timeWindows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
      });
      assertEquals(ctxRes.status, 201);
      contextId = (await ctxRes.json()).id;

      const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
        name: "Test Project Export",
        contextId,
      });
      assertEquals(projRes.status, 201);
      projectId = (await projRes.json()).id;

      // Create tasks
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: 'Integration Test Task With, Commas "and quotes"',
        projectId,
      });
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Open Task",
        projectId,
      });

      // Create and complete a task
      const doneRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Completed Export Task",
        projectId,
      });
      assertEquals(doneRes.status, 201);
      const doneTask = await doneRes.json();
      await apiCall(ctx.app, "POST", `/api/tasks/${doneTask.id}/complete`);
    });

    await t.step("GET /api/export returns full JSON export", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/export");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.exportedAt);
      assertEquals(body.version, "1.0");
      assertExists(body.projects);
      assertExists(body.contexts);
      assertExists(body.tasks);
    });

    await t.step(
      "GET /api/export?includeCompleted=true includes completed",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          "/api/export?includeCompleted=true",
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        const completedTasks = body.tasks.filter(
          (t: { completed_at: unknown }) => t.completed_at !== null,
        );
        assertEquals(completedTasks.length > 0, true);
      },
    );

    await t.step("GET /api/export?format=csv returns CSV", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/export?format=csv");
      assertEquals(res.status, 200);
      const contentType = res.headers.get("content-type");
      assertEquals(contentType, "text/csv");
      const csv = await res.text();
      // CSV should start with headers
      assertEquals(csv.startsWith("id,title,"), true);
    });

    await t.step("CSV export escapes special characters", async () => {
      const res = await apiCall(
        ctx.app,
        "GET",
        "/api/export?format=csv&includeCompleted=true",
      );
      assertEquals(res.status, 200);
      const csv = await res.text();
      // Should contain escaped quotes
      assertEquals(csv.includes('""and quotes""'), true);
    });

    await t.step("GET /api/export?projectId filters by project", async () => {
      const res = await apiCall(
        ctx.app,
        "GET",
        `/api/export?projectId=${projectId}`,
      );
      assertEquals(res.status, 200);
      const body = await res.json();
      for (
        const task of body.tasks as {
          project_id: string | null;
        }[]
      ) {
        assertEquals(task.project_id, projectId);
      }
    });

    await t.step("GET /api/export/tasks returns tasks only", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/export/tasks");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.tasks);
      assertExists(body.exportedAt);
    });

    await t.step("GET /api/export/tasks?format=csv returns CSV", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/export/tasks?format=csv");
      assertEquals(res.status, 200);
      assertEquals(res.headers.get("content-type"), "text/csv");
    });

    await t.step("GET /api/export/projects returns projects only", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/export/projects");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.projects);
      assertExists(body.exportedAt);
    });

    await t.step("GET /api/export/contexts returns contexts only", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/export/contexts");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.contexts);
      assertExists(body.exportedAt);
    });

    await t.step(
      "GET /api/export with includeDeleted includes deleted tasks",
      async () => {
        // Create and delete a task
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Delete Export Task",
          projectId,
        });
        const task = await createRes.json();
        await apiCall(ctx.app, "DELETE", `/api/tasks/${task.id}`);

        const res = await apiCall(
          ctx.app,
          "GET",
          "/api/export?includeDeleted=true",
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        const deletedTasks = body.tasks.filter(
          (t: { deleted_at: unknown }) => t.deleted_at !== null,
        );
        assertEquals(deletedTasks.length > 0, true);
      },
    );

    await t.step(
      "GET /api/export with includeDeleted and includeCompleted",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          "/api/export?includeDeleted=true&includeCompleted=true",
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        assertExists(body.tasks);
      },
    );

    await t.step(
      "GET /api/export returns 400 for invalid query params",
      async () => {
        const res = await apiCall(ctx.app, "GET", "/api/export?format=xml");
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Validation error");
      },
    );

    await t.step(
      "GET /api/export includes recurrence rules in task data",
      async () => {
        // Create a task with a recurrence rule
        const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Export Recurrence",
          projectId,
        });
        assertEquals(taskRes.status, 201);
        const task = await taskRes.json();

        await apiCall(ctx.app, "POST", "/api/recurrence", {
          taskId: task.id,
          scheduleType: "fixed",
          frequency: "daily",
          interval: 1,
        });

        const res = await apiCall(ctx.app, "GET", "/api/export");
        assertEquals(res.status, 200);
        const body = await res.json();
        const exportedTask = body.tasks.find(
          (t: { id: string }) => t.id === task.id,
        );
        assertExists(exportedTask);
        assertExists(exportedTask.recurrence);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
