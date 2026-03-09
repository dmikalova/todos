// Integration tests for Task CRUD operations
// Tests: create, read, update, delete, complete/incomplete, completed filter, pagination

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  TEST_USER_ID,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Task CRUD Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // Create a test project via direct DB (superuser bypasses RLS)
    const projectRes = await apiCall(ctx.app, "POST", "/api/projects", {
      name: "Test Project Tasks",
    });
    assertEquals(projectRes.status, 201);
    const project = await projectRes.json();
    const projectId = project.id;

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
      });

      assertEquals(res.status, 201, `Expected 201 but got ${res.status}`);
      const body = await res.json();

      assertExists(body.id);
      assertEquals(body.title, "Integration Test Full Task");
      assertEquals(body.description, "Test description");
      assertEquals(body.project_id, projectId);
      assertEquals(body.priority, 1);
      assertEquals(body.due_date.split("T")[0], dueDate);
      assertEquals(body.must_do, true);
      assertEquals(body.user_id, TEST_USER_ID);
    });

    await t.step(
      "POST /api/tasks accepts null for optional fields",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Minimal Task",
          description: null,
          projectId: null,
          priority: 4,
          dueDate: null,
        });

        assertEquals(res.status, 201, `Expected 201 but got ${res.status}`);
        const body = await res.json();

        assertExists(body.id);
        assertEquals(body.title, "Integration Test Minimal Task");
        assertEquals(body.description, null);
        assertEquals(body.project_id, null);
        assertEquals(body.priority, 4);
        assertEquals(body.due_date, null);
      },
    );

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
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Update Task",
        priority: 4,
      });
      assertEquals(createRes.status, 201);
      const created = await createRes.json();

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
        },
      );

      assertEquals(
        updateRes.status,
        200,
        `Expected 200 but got ${updateRes.status}`,
      );
      const updated = await updateRes.json();

      assertEquals(updated.title, "Updated Title");
      assertEquals(updated.description, "Updated description");
      assertEquals(updated.project_id, projectId);
      assertEquals(updated.priority, 2);
      assertEquals(updated.due_date.split("T")[0], dueDateStr);
      assertEquals(updated.must_do, true);
    });

    await t.step(
      "PATCH /api/tasks/:id can clear optional fields with null",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Clear Task",
          description: "To be cleared",
          projectId: projectId,
          priority: 1,
          dueDate: "2026-03-10",
        });
        assertEquals(createRes.status, 201);
        const created = await createRes.json();

        const updateRes = await apiCall(
          ctx.app,
          "PATCH",
          `/api/tasks/${created.id}`,
          {
            description: null,
            projectId: null,
            dueDate: null,
          },
        );

        assertEquals(updateRes.status, 200);
        const updated = await updateRes.json();

        assertEquals(updated.description, null);
        assertEquals(updated.project_id, null);
        assertEquals(updated.due_date, null);
      },
    );

    await t.step(
      "PATCH /api/tasks/:id partial update preserves other fields",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Partial Task",
          description: "Keep this",
          priority: 1,
          dueDate: "2026-03-15",
        });
        assertEquals(createRes.status, 201);
        const created = await createRes.json();

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

        assertEquals(updated.title, "Only Title Changed");
        assertEquals(updated.description, "Keep this");
        assertEquals(updated.priority, 1);
        assertEquals(updated.due_date.split("T")[0], "2026-03-15");
      },
    );

    await t.step("POST /api/tasks/:id/complete completes task", async () => {
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Complete Task",
        priority: 2,
      });
      assertEquals(createRes.status, 201);
      const created = await createRes.json();

      const completeRes = await apiCall(
        ctx.app,
        "POST",
        `/api/tasks/${created.id}/complete`,
      );

      assertEquals(completeRes.status, 200);
      const completed = await completeRes.json();
      assertExists(completed.completed_at);
    });

    await t.step(
      "DELETE /api/tasks/:id/complete uncompletes task",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Incomplete Task",
          priority: 2,
        });
        assertEquals(createRes.status, 201);
        const created = await createRes.json();

        await apiCall(ctx.app, "POST", `/api/tasks/${created.id}/complete`);

        const incompleteRes = await apiCall(
          ctx.app,
          "DELETE",
          `/api/tasks/${created.id}/complete`,
        );

        assertEquals(incompleteRes.status, 200);
        const uncompleted = await incompleteRes.json();
        assertEquals(uncompleted.completed_at, null);
      },
    );

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

    await t.step(
      "GET /api/tasks?completed=false excludes completed tasks",
      async () => {
        // Create an open task and a completed task
        const openRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Open Filter",
          priority: 3,
        });
        assertEquals(openRes.status, 201);

        const completedRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Completed Filter",
          priority: 3,
        });
        assertEquals(completedRes.status, 201);
        const completedTask = await completedRes.json();
        await apiCall(
          ctx.app,
          "POST",
          `/api/tasks/${completedTask.id}/complete`,
        );

        // Filter for open tasks
        const listRes = await apiCall(
          ctx.app,
          "GET",
          "/api/tasks?completed=false",
        );
        assertEquals(listRes.status, 200);
        const tasks = await listRes.json();

        // No task in results should have completed_at
        for (const task of tasks) {
          assertEquals(task.completed_at, null);
        }
      },
    );

    await t.step(
      "GET /api/tasks?completed=true returns only completed tasks",
      async () => {
        const listRes = await apiCall(
          ctx.app,
          "GET",
          "/api/tasks?completed=true",
        );
        assertEquals(listRes.status, 200);
        const tasks = await listRes.json();

        // Every returned task should have completed_at set
        for (const task of tasks) {
          assertExists(task.completed_at);
        }
      },
    );

    await t.step(
      "GET /api/tasks supports limit and offset pagination",
      async () => {
        // Create 3 tasks with known titles
        for (let i = 1; i <= 3; i++) {
          const res = await apiCall(ctx.app, "POST", "/api/tasks", {
            title: `Integration Test Paginate ${i}`,
            priority: 4,
          });
          assertEquals(res.status, 201);
        }

        // Get first page (limit 2)
        const page1Res = await apiCall(
          ctx.app,
          "GET",
          "/api/tasks?completed=false&limit=2&offset=0",
        );
        assertEquals(page1Res.status, 200);
        const page1 = await page1Res.json();
        assertEquals(page1.length, 2);

        // Get second page
        const page2Res = await apiCall(
          ctx.app,
          "GET",
          "/api/tasks?completed=false&limit=2&offset=2",
        );
        assertEquals(page2Res.status, 200);
        const page2 = await page2Res.json();

        // Page 2 should be non-empty (we have more than 2 open tasks)
        assertEquals(page2.length > 0, true);

        // No overlap between pages
        const page1Ids = page1.map((t: { id: string }) => t.id);
        for (const task of page2) {
          assertEquals(page1Ids.includes(task.id), false);
        }
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
