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
      "PATCH /api/projects/:id updates description, color, and parentProjectId",
      async () => {
        // Create a parent project
        const parentRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Parent Project Merge",
        });
        assertEquals(parentRes.status, 201);
        const parent = await parentRes.json();

        // Update description, color, and parentProjectId together
        const res = await apiCall(
          ctx.app,
          "PATCH",
          `/api/projects/${projectId}`,
          {
            description: "Updated description",
            color: "#ff0000",
            parentProjectId: parent.id,
          },
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.description, "Updated description");
        assertEquals(body.color, "#ff0000");
        assertEquals(body.parent_project_id, parent.id);
      },
    );

    await t.step(
      "GET /api/projects/:id returns context_id and parent_project_id",
      async () => {
        const res = await apiCall(ctx.app, "GET", `/api/projects/${projectId}`);
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.id, projectId);
        assertEquals(body.name, "Test Project With Context");
        assertEquals(body.description, "Updated description");
        assertEquals(body.color, "#ff0000");
        assertEquals(typeof body.context_id, "string");
        assertEquals(typeof body.parent_project_id, "string");
        assertEquals(typeof body.task_count, "number");
      },
    );

    await t.step(
      "GET /api/projects list includes context_id and parent_project_id",
      async () => {
        const res = await apiCall(ctx.app, "GET", "/api/projects");
        assertEquals(res.status, 200);
        const projects = await res.json();
        const proj = projects.find((p: { id: string }) => p.id === projectId);
        assertExists(proj);
        assertEquals(typeof proj.context_id, "string");
        assertEquals(typeof proj.parent_project_id, "string");
      },
    );

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

    // --- Nesting integration tests ---

    await t.step(
      "PATCH circular ref: setting parent to self returns 400",
      async () => {
        const res = await apiCall(
          ctx.app,
          "PATCH",
          `/api/projects/${projectId}`,
          {
            parentProjectId: projectId,
          },
        );
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "A project cannot be its own parent");
      },
    );

    await t.step(
      "PATCH circular ref: setting parent to descendant returns 400",
      async () => {
        // Create a chain: parent -> child -> grandchild
        const childRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Circular Child",
          parentProjectId: projectId,
        });
        assertEquals(childRes.status, 201);
        const child = await childRes.json();

        const grandchildRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Circular Grandchild",
          parentProjectId: child.id,
        });
        assertEquals(grandchildRes.status, 201);
        const grandchild = await grandchildRes.json();

        // Try to set parent's parent to its grandchild — should fail
        const res = await apiCall(
          ctx.app,
          "PATCH",
          `/api/projects/${projectId}`,
          {
            parentProjectId: grandchild.id,
          },
        );
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Cannot set parent to a descendant project");
      },
    );

    await t.step(
      "DELETE parent project orphans children (clears parent_project_id)",
      async () => {
        // Create a parent with a child
        const parentRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Orphan Parent",
        });
        assertEquals(parentRes.status, 201);
        const parent = await parentRes.json();

        const orphanChildRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Orphan Child",
          parentProjectId: parent.id,
        });
        assertEquals(orphanChildRes.status, 201);
        const orphanChild = await orphanChildRes.json();
        assertEquals(orphanChild.parent_project_id, parent.id);

        // Delete the parent
        const deleteRes = await apiCall(
          ctx.app,
          "DELETE",
          `/api/projects/${parent.id}`,
        );
        assertEquals(deleteRes.status, 200);

        // The child should now be a root project (parent_project_id = null)
        const listRes = await apiCall(ctx.app, "GET", "/api/projects");
        assertEquals(listRes.status, 200);
        const projects = await listRes.json();
        const updatedChild = projects.find(
          (p: { id: string }) => p.id === orphanChild.id,
        );
        assertExists(updatedChild);
        assertEquals(updatedChild.parent_project_id, null);
      },
    );

    // -----------------------------------------------------------------------
    // Validation and error path tests
    // -----------------------------------------------------------------------

    await t.step(
      "POST /api/projects returns 400 for invalid body",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/projects", {
          // missing required 'name'
          description: "No name",
        });
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Validation error");
      },
    );

    await t.step(
      "PATCH /api/projects/:id returns 400 for invalid body",
      async () => {
        const res = await apiCall(
          ctx.app,
          "PATCH",
          `/api/projects/${projectId}`,
          {
            name: "", // empty string violates min(1)
          },
        );
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Validation error");
      },
    );

    await t.step(
      "GET /api/projects/:id returns 404 for non-existent project",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          "/api/projects/00000000-0000-0000-0000-000000000099",
        );
        assertEquals(res.status, 404);
        const body = await res.json();
        assertEquals(body.error, "Project not found");
      },
    );

    await t.step(
      "PATCH /api/projects/:id returns 404 for non-existent project",
      async () => {
        const res = await apiCall(
          ctx.app,
          "PATCH",
          "/api/projects/00000000-0000-0000-0000-000000000099",
          { name: "Ghost" },
        );
        assertEquals(res.status, 404);
        const body = await res.json();
        assertEquals(body.error, "Project not found");
      },
    );

    await t.step(
      "DELETE /api/projects/:id returns 404 for non-existent project",
      async () => {
        const res = await apiCall(
          ctx.app,
          "DELETE",
          "/api/projects/00000000-0000-0000-0000-000000000099",
        );
        assertEquals(res.status, 404);
        const body = await res.json();
        assertEquals(body.error, "Project not found");
      },
    );

    await t.step(
      "GET /api/projects/inbox returns tasks without project",
      async () => {
        // Create a task without a project
        await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Inbox Task",
          priority: 3,
        });

        const res = await apiCall(ctx.app, "GET", "/api/projects/inbox");
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.name, "Inbox");
        assertExists(body.tasks);
        assertEquals(body.tasks.length > 0, true);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
