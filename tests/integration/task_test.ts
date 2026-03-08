// Integration tests for Task CRUD operations
// Tests: create, read, update, delete with all fields

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
  testId,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Task CRUD Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // Create a test project for testing task-project relationship
    const projectId = testId("project");
    await ctx.db`
      INSERT INTO todos.projects (id, name, created_at, updated_at)
      VALUES (${projectId}, 'Test Project Tasks', NOW(), NOW())
    `;

    // Create a test context for testing task-context relationship
    const contextId = testId("context");
    await ctx.db`
      INSERT INTO todos.contexts (id, name, created_at, updated_at)
      VALUES (${contextId}, 'Test Context Tasks', NOW(), NOW())
    `;

    await t.step("POST /api/tasks creates task with all fields", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dueDate = tomorrow.toISOString().split("T")[0];

      const res = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Full Task",
        description: "Test description",
        projectId: projectId,
        priority: 1,
        dueDate: dueDate,
        mustDo: true,
        contextIds: [contextId],
      });

      assertEquals(res.status, 201, `Expected 201 but got ${res.status}`);
      const body = await res.json();

      assertExists(body.id);
      assertEquals(body.title, "Integration Test Full Task");
      assertEquals(body.description, "Test description");
      assertEquals(body.project_id, projectId);
      assertEquals(body.priority, 1);
      assertEquals(body.due_date, dueDate);
      assertEquals(body.must_do, true);
      assertEquals(body.context_ids, [contextId]);
    });

    await t.step("POST /api/tasks accepts null for optional fields", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Minimal Task",
        description: null,
        projectId: null,
        priority: 4,
        dueDate: null,
        contextIds: [],
      });

      assertEquals(res.status, 201, `Expected 201 but got ${res.status}`);
      const body = await res.json();

      assertExists(body.id);
      assertEquals(body.title, "Integration Test Minimal Task");
      assertEquals(body.description, null);
      assertEquals(body.project_id, null);
      assertEquals(body.priority, 4);
      assertEquals(body.due_date, null);
    });

    await t.step("POST /api/tasks validates title is required", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/tasks", {
        description: "Missing title",
        priority: 2,
      });

      assertEquals(res.status, 400);
      const body = await res.json();
      assertEquals(body.error, "Validation error");
    });

    await t.step("PATCH /api/tasks/:id updates all fields", async () => {
      // First create a task
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Update Task",
        priority: 4,
      });
      assertEquals(createRes.status, 201);
      const created = await createRes.json();

      // Now update all fields
      const newDueDate = new Date();
      newDueDate.setDate(newDueDate.getDate() + 7);
      const dueDateStr = newDueDate.toISOString().split("T")[0];

      const updateRes = await apiCall(
        ctx.app,
        "PATCH",
        `/api/tasks/${created.id}`,
        {
          title: "Updated Title",
          description: "Updated description",
          projectId: projectId,
          priority: 2,
          dueDate: dueDateStr,
          mustDo: true,
          contextIds: [contextId],
        },
      );

      assertEquals(updateRes.status, 200, `Expected 200 but got ${updateRes.status}`);
      const updated = await updateRes.json();

      assertEquals(updated.title, "Updated Title");
      assertEquals(updated.description, "Updated description");
      assertEquals(updated.project_id, projectId);
      assertEquals(updated.priority, 2);
      assertEquals(updated.due_date, dueDateStr);
      assertEquals(updated.must_do, true);
      assertEquals(updated.context_ids, [contextId]);
    });

    await t.step("PATCH /api/tasks/:id can clear optional fields with null", async () => {
      // First create a task with all fields
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Clear Task",
        description: "To be cleared",
        projectId: projectId,
        priority: 1,
        dueDate: "2026-03-10",
        contextIds: [contextId],
      });
      assertEquals(createRes.status, 201);
      const created = await createRes.json();

      // Now clear the optional fields
      const updateRes = await apiCall(
        ctx.app,
        "PATCH",
        `/api/tasks/${created.id}`,
        {
          description: null,
          projectId: null,
          dueDate: null,
          contextIds: [],
        },
      );

      assertEquals(updateRes.status, 200);
      const updated = await updateRes.json();

      assertEquals(updated.description, null);
      assertEquals(updated.project_id, null);
      assertEquals(updated.due_date, null);
      assertEquals(updated.context_ids, []);
    });

    await t.step("PATCH /api/tasks/:id partial update preserves other fields", async () => {
      // First create a task with several fields
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Partial Task",
        description: "Keep this",
        priority: 1,
        dueDate: "2026-03-15",
      });
      assertEquals(createRes.status, 201);
      const created = await createRes.json();

      // Now update only the title
      const updateRes = await apiCall(
        ctx.app,
        "PATCH",
        `/api/tasks/${created.id}`,
        {
          title: "Only Title Changed",
        },
      );

      assertEquals(updateRes.status, 200);
      const updated = await updateRes.json();

      // Title should change, others should stay
      assertEquals(updated.title, "Only Title Changed");
      assertEquals(updated.description, "Keep this");
      assertEquals(updated.priority, 1);
      assertEquals(updated.due_date, "2026-03-15");
    });

    await t.step("POST /api/tasks/:id/complete completes task", async () => {
      // Create a task
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Complete Task",
        priority: 2,
      });
      assertEquals(createRes.status, 201);
      const created = await createRes.json();

      // Complete it
      const completeRes = await apiCall(
        ctx.app,
        "POST",
        `/api/tasks/${created.id}/complete`,
      );

      assertEquals(completeRes.status, 200);
      const completed = await completeRes.json();
      assertExists(completed.completed_at);
    });

    await t.step("DELETE /api/tasks/:id/complete uncompletes task", async () => {
      // Create and complete a task
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Uncomplete Task",
        priority: 2,
      });
      assertEquals(createRes.status, 201);
      const created = await createRes.json();

      await apiCall(ctx.app, "POST", `/api/tasks/${created.id}/complete`);

      // Uncomplete it
      const uncompleteRes = await apiCall(
        ctx.app,
        "DELETE",
        `/api/tasks/${created.id}/complete`,
      );

      assertEquals(uncompleteRes.status, 200);
      const uncompleted = await uncompleteRes.json();
      assertEquals(uncompleted.completed_at, null);
    });

    await t.step("DELETE /api/tasks/:id soft deletes task", async () => {
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Delete Task",
        priority: 2,
      });
      assertEquals(createRes.status, 201);
      const created = await createRes.json();

      const deleteRes = await apiCall(
        ctx.app,
        "DELETE",
        `/api/tasks/${created.id}`,
      );

      assertEquals(deleteRes.status, 200);
      const body = await deleteRes.json();
      assertEquals(body.message, "Task deleted");
    });

    // Cleanup
    await teardownTestContext(ctx);
  },
});
