// Integration tests for ownership validation
// Under RLS, foreign resources are invisible to the session user, so
// assertOwnership returns 404 (not found) instead of 403 (forbidden).

import { assertEquals } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

const OTHER_USER_ID = "00000000-0000-0000-0000-000000000002";

let ctx: TestContext;

Deno.test({
  name: "Ownership Validation Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // Create resources owned by OTHER_USER_ID via superuser DB (bypasses RLS)
    const otherProjectId = crypto.randomUUID();
    const otherContextId = crypto.randomUUID();
    const otherTaskId = crypto.randomUUID();

    await ctx.db`
      INSERT INTO todos.projects (id, user_id, name, created_at)
      VALUES (${otherProjectId}, ${OTHER_USER_ID}, 'Other User Project', NOW())
    `;
    await ctx.db`
      INSERT INTO todos.contexts (id, user_id, name, created_at)
      VALUES (${otherContextId}, ${OTHER_USER_ID}, 'Other User Context', NOW())
    `;
    await ctx.db`
      INSERT INTO todos.tasks (id, user_id, title, priority, created_at)
      VALUES (${otherTaskId}, ${OTHER_USER_ID}, 'Other User Task', 3, NOW())
    `;

    await t.step(
      "POST /api/tasks with foreign projectId returns 404",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Ownership Task",
          priority: 3,
          projectId: otherProjectId,
        });

        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "PATCH /api/tasks/:id with foreign projectId returns 404",
      async () => {
        // Create a task owned by test user
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Own Task",
          priority: 3,
        });
        assertEquals(createRes.status, 201);
        const task = await createRes.json();

        // Try to move it to another user's project
        const res = await apiCall(ctx.app, "PATCH", `/api/tasks/${task.id}`, {
          projectId: otherProjectId,
        });

        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "POST /api/projects with foreign contextId returns 404",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Integration Test Ownership Project",
          contextId: otherContextId,
        });

        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "PATCH /api/projects/:id with foreign contextId returns 404",
      async () => {
        // Create a project owned by test user
        const createRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Integration Test Own Project",
        });
        assertEquals(createRes.status, 201);
        const project = await createRes.json();

        const res = await apiCall(
          ctx.app,
          "PATCH",
          `/api/projects/${project.id}`,
          { contextId: otherContextId },
        );

        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "POST /api/projects with foreign parentProjectId returns 404",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Integration Test Child Project",
          parentProjectId: otherProjectId,
        });

        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "PATCH /api/projects/:id with foreign parentProjectId returns 404",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Integration Test Own Parent",
        });
        assertEquals(createRes.status, 201);
        const project = await createRes.json();

        const res = await apiCall(
          ctx.app,
          "PATCH",
          `/api/projects/${project.id}`,
          { parentProjectId: otherProjectId },
        );

        assertEquals(res.status, 404);
      },
    );

    await t.step("Non-existent resource ID returns 404", async () => {
      const fakeId = "00000000-0000-0000-0000-999999999999";

      const res = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test 404 Task",
        priority: 3,
        projectId: fakeId,
      });

      assertEquals(res.status, 404);
    });

    // Clean up other user's data (not handled by standard cleanup which only cleans test user)
    await ctx.db`DELETE FROM todos.tasks WHERE id = ${otherTaskId}`;
    await ctx.db`DELETE FROM todos.projects WHERE id = ${otherProjectId}`;
    await ctx.db`DELETE FROM todos.contexts WHERE id = ${otherContextId}`;

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
