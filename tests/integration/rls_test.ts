// Integration tests for RLS (Row-Level Security) enforcement
// Tests: cross-user data isolation — SELECT/UPDATE/DELETE returns zero rows for other users' data

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
  name: "RLS Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // Create resources owned by OTHER_USER_ID via superuser DB (bypasses RLS)
    const otherProjectId = crypto.randomUUID();
    const otherContextId = crypto.randomUUID();
    const otherTaskId = crypto.randomUUID();

    await ctx.db`
      INSERT INTO todos.contexts (id, user_id, name, created_at)
      VALUES (${otherContextId}, ${OTHER_USER_ID}, 'RLS Other Context', NOW())
    `;
    await ctx.db`
      INSERT INTO todos.projects (id, user_id, name, created_at)
      VALUES (${otherProjectId}, ${OTHER_USER_ID}, 'RLS Other Project', NOW())
    `;
    await ctx.db`
      INSERT INTO todos.tasks (id, user_id, title, priority, project_id, created_at)
      VALUES (${otherTaskId}, ${OTHER_USER_ID}, 'RLS Other Task', 3, ${otherProjectId}, NOW())
    `;

    await t.step(
      "GET /api/tasks does not return other user's tasks",
      async () => {
        const res = await apiCall(ctx.app, "GET", "/api/tasks");
        assertEquals(res.status, 200);
        const tasks = await res.json();

        const otherTask = tasks.find(
          (t: { id: string }) => t.id === otherTaskId,
        );
        assertEquals(otherTask, undefined);
      },
    );

    await t.step(
      "GET /api/projects does not return other user's projects",
      async () => {
        const res = await apiCall(ctx.app, "GET", "/api/projects");
        assertEquals(res.status, 200);
        const projects = await res.json();

        const otherProject = projects.find(
          (p: { id: string }) => p.id === otherProjectId,
        );
        assertEquals(otherProject, undefined);
      },
    );

    await t.step(
      "GET /api/contexts does not return other user's contexts",
      async () => {
        const res = await apiCall(ctx.app, "GET", "/api/contexts");
        assertEquals(res.status, 200);
        const contexts = await res.json();

        const otherContext = contexts.find(
          (c: { id: string }) => c.id === otherContextId,
        );
        assertEquals(otherContext, undefined);
      },
    );

    await t.step(
      "GET /api/next does not return other user's tasks",
      async () => {
        const res = await apiCall(ctx.app, "GET", "/api/next");
        assertEquals(res.status, 200);
        const body = await res.json();

        const otherTask = body.tasks.find(
          (t: { id: string }) => t.id === otherTaskId,
        );
        assertEquals(otherTask, undefined);
      },
    );

    await t.step(
      "GET /api/tasks/:id returns 404 for other user's task",
      async () => {
        const res = await apiCall(ctx.app, "GET", `/api/tasks/${otherTaskId}`);
        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "PATCH /api/tasks/:id returns 404 for other user's task",
      async () => {
        const res = await apiCall(
          ctx.app,
          "PATCH",
          `/api/tasks/${otherTaskId}`,
          { title: "Attempted Hijack" },
        );
        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "DELETE /api/tasks/:id returns 404 for other user's task",
      async () => {
        const res = await apiCall(
          ctx.app,
          "DELETE",
          `/api/tasks/${otherTaskId}`,
        );
        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "PATCH /api/projects/:id returns 404 for other user's project",
      async () => {
        const res = await apiCall(
          ctx.app,
          "PATCH",
          `/api/projects/${otherProjectId}`,
          { name: "Attempted Hijack" },
        );
        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "DELETE /api/contexts/:id returns 404 for other user's context",
      async () => {
        const res = await apiCall(
          ctx.app,
          "DELETE",
          `/api/contexts/${otherContextId}`,
        );
        assertEquals(res.status, 404);
      },
    );

    // Verify other user's data still exists (RLS hid it, didn't delete it)
    const [taskStillExists] = await ctx.db`
      SELECT id FROM todos.tasks WHERE id = ${otherTaskId}
    `;
    assertEquals(taskStillExists.id, otherTaskId);

    // Clean up other user's data
    await ctx.db`DELETE FROM todos.tasks WHERE id = ${otherTaskId}`;
    await ctx.db`DELETE FROM todos.projects WHERE id = ${otherProjectId}`;
    await ctx.db`DELETE FROM todos.contexts WHERE id = ${otherContextId}`;

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
