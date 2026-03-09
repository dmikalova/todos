// Integration tests for Project CRUD
// Tests: create with contextId, update contextId, task_count excludes completed, nested parentProjectId

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Project CRUD Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // Create a context for testing project-context relationship
    let contextId: string;
    let projectId: string;

    await t.step("setup: create context", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/contexts", {
        name: "Test Context Projects",
        timeWindows: [],
      });
      assertEquals(res.status, 201);
      const body = await res.json();
      contextId = body.id;
    });

    await t.step(
      "POST /api/projects creates project with contextId",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project With Context",
          contextId,
        });

        assertEquals(res.status, 201, `Expected 201 but got ${res.status}`);
        const body = await res.json();

        assertExists(body.id);
        assertEquals(body.name, "Test Project With Context");
        assertEquals(body.context_id, contextId);

        projectId = body.id;
      },
    );

    await t.step("PATCH /api/projects/:id updates contextId", async () => {
      // Create a second context
      const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
        name: "Test Context Projects 2",
        timeWindows: [],
      });
      assertEquals(ctxRes.status, 201);
      const newCtx = await ctxRes.json();

      const res = await apiCall(
        ctx.app,
        "PATCH",
        `/api/projects/${projectId}`,
        {
          contextId: newCtx.id,
        },
      );

      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.context_id, newCtx.id);
    });

    await t.step(
      "GET /api/projects/:id task_count excludes completed tasks",
      async () => {
        // Create open and completed tasks for this project
        await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Open Task",
          projectId,
        });

        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Done Task",
          projectId,
        });
        assertEquals(createRes.status, 201);
        const doneTask = await createRes.json();

        // Complete the second task
        await apiCall(ctx.app, "POST", `/api/tasks/${doneTask.id}/complete`);

        // Get projects and check task_count
        const res = await apiCall(ctx.app, "GET", "/api/projects");
        assertEquals(res.status, 200);
        const projects = await res.json();

        const proj = projects.find((p: { id: string }) => p.id === projectId);
        assertExists(proj);
        // task_count should only count open (non-completed, non-deleted) tasks
        assertEquals(proj.task_count, 1);
      },
    );

    await t.step("nested project stores parentProjectId", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/projects", {
        name: "Test Project Child",
        parentProjectId: projectId,
      });

      assertEquals(res.status, 201);
      const body = await res.json();

      assertEquals(body.parent_project_id, projectId);
    });

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
