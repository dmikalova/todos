// Integration tests for Next endpoint and project-based context filtering
// Tests: eligible tasks returned, deferred excluded, project filter, inbox excluded from context

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

    await t.step("GET /api/next returns eligible tasks", async () => {
      // Create tasks via API (sets user_id from session)
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Eligible 1",
        priority: 3,
      });
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Eligible 2",
        priority: 2,
      });

      const res = await apiCall(ctx.app, "GET", "/api/next");
      assertEquals(res.status, 200);
      const body = await res.json();

      assertExists(body.tasks);
      assertEquals(body.tasks.length >= 2, true);
    });

    await t.step("GET /api/next excludes completed tasks", async () => {
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Completed",
        priority: 2,
      });
      assertEquals(createRes.status, 201);
      const task = await createRes.json();

      // Complete the task
      await apiCall(ctx.app, "POST", `/api/tasks/${task.id}/complete`);

      const res = await apiCall(ctx.app, "GET", "/api/next");
      assertEquals(res.status, 200);
      const body = await res.json();

      const titles = body.tasks.map((t: { title: string }) => t.title);
      assertEquals(titles.includes("Integration Test Next Completed"), false);
    });

    await t.step("GET /api/next excludes deferred tasks", async () => {
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Deferred",
        priority: 2,
      });
      assertEquals(createRes.status, 201);
      const task = await createRes.json();

      // Defer the task
      await apiCall(ctx.app, "POST", `/api/tasks/${task.id}/defer`, {
        preset: "tomorrow",
      });

      const res = await apiCall(ctx.app, "GET", "/api/next");
      assertEquals(res.status, 200);
      const body = await res.json();

      const titles = body.tasks.map((t: { title: string }) => t.title);
      assertEquals(titles.includes("Integration Test Next Deferred"), false);
    });

    await t.step("GET /api/next?projectId filters by project", async () => {
      // Create a project
      const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
        name: "Test Project Next Filter",
      });
      assertEquals(projRes.status, 201);
      const project = await projRes.json();

      // Create task in project
      const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next In Project",
        priority: 2,
        projectId: project.id,
      });
      assertEquals(taskRes.status, 201);

      // Create task without project
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next No Project",
        priority: 2,
      });

      // Filter by projectId
      const res = await apiCall(
        ctx.app,
        "GET",
        `/api/next?projectId=${project.id}`,
      );
      assertEquals(res.status, 200);
      const body = await res.json();

      // All returned tasks should belong to the project
      for (const task of body.tasks) {
        assertEquals(task.project_id, project.id);
      }
      // Should include our project task
      const titles = body.tasks.map((t: { title: string }) => t.title);
      assertEquals(titles.includes("Integration Test Next In Project"), true);
    });

    await t.step("GET /api/next sorts by due date ascending", async () => {
      // Create a new project to isolate tasks
      const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
        name: "Test Project Next Sort",
      });
      assertEquals(projRes.status, 201);
      const project = await projRes.json();

      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      // Create task due today first
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Due Later",
        priority: 2,
        projectId: project.id,
        dueDate: today.toISOString().split("T")[0],
      });

      // Create task due yesterday second
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Due Sooner",
        priority: 2,
        projectId: project.id,
        dueDate: yesterday.toISOString().split("T")[0],
      });

      // Filter by project to only see our test tasks
      const res = await apiCall(
        ctx.app,
        "GET",
        `/api/next?projectId=${project.id}`,
      );
      assertEquals(res.status, 200);
      const body = await res.json();

      // Due sooner should come before due later
      const titles = body.tasks.map((t: { title: string }) => t.title);
      const soonerIdx = titles.indexOf("Integration Test Next Due Sooner");
      const laterIdx = titles.indexOf("Integration Test Next Due Later");
      assertEquals(soonerIdx < laterIdx, true);
    });

    await t.step("GET /api/next excludes future-dated tasks", async () => {
      const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
        name: "Test Project Next Future",
      });
      assertEquals(projRes.status, 201);
      const project = await projRes.json();

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create a task due tomorrow
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next Future Task",
        priority: 2,
        projectId: project.id,
        dueDate: tomorrow.toISOString().split("T")[0],
      });

      // Create a task with no due date (should still appear)
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Next No Date Task",
        priority: 2,
        projectId: project.id,
      });

      const res = await apiCall(
        ctx.app,
        "GET",
        `/api/next?projectId=${project.id}`,
      );
      assertEquals(res.status, 200);
      const body = await res.json();

      const titles = body.tasks.map((t: { title: string }) => t.title);
      assertEquals(titles.includes("Integration Test Next Future Task"), false);
      assertEquals(titles.includes("Integration Test Next No Date Task"), true);
    });

    await t.step(
      "POST /api/tasks/:id/defer defers task with preset",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Defer Action",
          priority: 3,
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

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
