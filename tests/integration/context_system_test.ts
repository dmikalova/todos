// Integration tests for context system redesign
// Tests: project_contexts/task_contexts join tables, context resolution CTE,
//        multi-level inheritance, override behavior, context rank reordering

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Context System Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    // -----------------------------------------------------------------------
    // Section 13: Schema and Migration
    // -----------------------------------------------------------------------

    await t.step(
      "project_contexts join table exists with correct cascades",
      async () => {
        // Create context and project
        const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Schema",
          timeWindows: [],
        });
        assertEquals(ctxRes.status, 201);
        const context = await ctxRes.json();

        const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Schema",
          contextIds: [context.id],
        });
        assertEquals(projRes.status, 201);
        const project = await projRes.json();

        // Verify join table row exists
        const rows = await ctx
          .db`SELECT * FROM tasks.project_contexts WHERE project_id = ${project.id}`;
        assertEquals(rows.length, 1);
        assertEquals(rows[0].context_id, context.id);

        // Delete project — should cascade delete join table row
        await apiCall(ctx.app, "DELETE", `/api/projects/${project.id}`);
        const afterDelete = await ctx
          .db`SELECT * FROM tasks.project_contexts WHERE project_id = ${project.id}`;
        assertEquals(afterDelete.length, 0);
      },
    );

    await t.step(
      "task_contexts join table exists with correct cascades",
      async () => {
        const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Task Schema",
          timeWindows: [],
        });
        assertEquals(ctxRes.status, 201);
        const context = await ctxRes.json();

        const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Task Schema",
          priority: 2,
          contextIds: [context.id],
        });
        assertEquals(taskRes.status, 201);
        const task = await taskRes.json();

        // Verify join table row exists
        const rows = await ctx
          .db`SELECT * FROM tasks.task_contexts WHERE task_id = ${task.id}`;
        assertEquals(rows.length, 1);
        assertEquals(rows[0].context_id, context.id);

        // Hard-delete task (API soft-deletes) — FK CASCADE should remove join rows
        await ctx.db`DELETE FROM tasks.task_history WHERE task_id = ${task.id}`;
        await ctx.db`DELETE FROM tasks.tasks WHERE id = ${task.id}`;
        const afterDelete = await ctx
          .db`SELECT * FROM tasks.task_contexts WHERE task_id = ${task.id}`;
        assertEquals(afterDelete.length, 0);
      },
    );

    await t.step("must_do column no longer exists on tasks", async () => {
      const cols = await ctx
        .db`SELECT column_name FROM information_schema.columns WHERE table_schema = 'tasks' AND table_name = 'tasks' AND column_name = 'must_do'`;
      assertEquals(cols.length, 0);
    });

    await t.step("context_id column no longer exists on projects", async () => {
      const cols = await ctx
        .db`SELECT column_name FROM information_schema.columns WHERE table_schema = 'tasks' AND table_name = 'projects' AND column_name = 'context_id'`;
      assertEquals(cols.length, 0);
    });

    // -----------------------------------------------------------------------
    // Section 14: Project Context CRUD
    // -----------------------------------------------------------------------

    let ctx1Id: string;
    let ctx2Id: string;

    await t.step("setup: create two contexts", async () => {
      const r1 = await apiCall(ctx.app, "POST", "/api/contexts", {
        name: "Test Context Multi A",
        timeWindows: [],
      });
      assertEquals(r1.status, 201);
      ctx1Id = (await r1.json()).id;

      const r2 = await apiCall(ctx.app, "POST", "/api/contexts", {
        name: "Test Context Multi B",
        timeWindows: [],
      });
      assertEquals(r2.status, 201);
      ctx2Id = (await r2.json()).id;
    });

    await t.step(
      "create project with multiple contexts returns context_ids array",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Multi Context",
          contextIds: [ctx1Id, ctx2Id],
        });
        assertEquals(res.status, 201);
        const body = await res.json();

        assertEquals(Array.isArray(body.context_ids), true);
        assertEquals(body.context_ids.length, 2);
        assertEquals(body.context_ids.includes(ctx1Id), true);
        assertEquals(body.context_ids.includes(ctx2Id), true);
      },
    );

    await t.step("update project contexts replaces old with new", async () => {
      // Create a project with ctx1
      const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
        name: "Test Project Replace Ctx",
        contextIds: [ctx1Id],
      });
      assertEquals(projRes.status, 201);
      const project = await projRes.json();
      assertEquals(project.context_ids, [ctx1Id]);

      // Update to ctx2 only
      const updateRes = await apiCall(
        ctx.app,
        "PATCH",
        `/api/projects/${project.id}`,
        { contextIds: [ctx2Id] },
      );
      assertEquals(updateRes.status, 200);
      const updated = await updateRes.json();
      assertEquals(updated.context_ids, [ctx2Id]);

      // Verify old context row is gone
      const rows = await ctx
        .db`SELECT * FROM tasks.project_contexts WHERE project_id = ${project.id}`;
      assertEquals(rows.length, 1);
      assertEquals(rows[0].context_id, ctx2Id);
    });

    await t.step(
      "ownership validation: reject context IDs of another user",
      async () => {
        // Insert a context owned by a different user directly
        const otherUserId = "00000000-0000-0000-0000-000000000099";
        await ctx.db`INSERT INTO tasks.contexts (id, user_id, name)
          VALUES (gen_random_uuid(), ${otherUserId}, 'Other User Context')`;
        const otherCtx = await ctx
          .db`SELECT id FROM tasks.contexts WHERE user_id = ${otherUserId} LIMIT 1`;

        const res = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Bad Context",
          contextIds: [otherCtx[0].id],
        });
        // RLS hides other user's resources → assertOwnership returns 404
        assertEquals(res.status, 404);
      },
    );

    // -----------------------------------------------------------------------
    // Section 15: Task Context CRUD
    // -----------------------------------------------------------------------

    await t.step("create task with contexts returns context_ids", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Task With Contexts",
        priority: 2,
        contextIds: [ctx1Id, ctx2Id],
      });
      assertEquals(res.status, 201);
      const body = await res.json();

      assertEquals(Array.isArray(body.context_ids), true);
      assertEquals(body.context_ids.length, 2);
      assertEquals(body.context_ids.includes(ctx1Id), true);
      assertEquals(body.context_ids.includes(ctx2Id), true);
    });

    await t.step("update task contexts replaces old", async () => {
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Task Replace Ctx",
        priority: 3,
        contextIds: [ctx1Id],
      });
      assertEquals(createRes.status, 201);
      const task = await createRes.json();

      const updateRes = await apiCall(
        ctx.app,
        "PATCH",
        `/api/tasks/${task.id}`,
        { contextIds: [ctx2Id] },
      );
      assertEquals(updateRes.status, 200);
      const updated = await updateRes.json();
      assertEquals(updated.context_ids, [ctx2Id]);
    });

    // -----------------------------------------------------------------------
    // Section 16: Context Task Resolution
    // -----------------------------------------------------------------------

    await t.step(
      "GET /api/contexts/:id/tasks returns tasks with direct context",
      async () => {
        // Create a context
        const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Resolution Direct",
          timeWindows: [],
        });
        assertEquals(ctxRes.status, 201);
        const context = await ctxRes.json();

        // Create task with that context directly
        await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Direct Context Task",
          priority: 1,
          contextIds: [context.id],
        });

        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/${context.id}/tasks`,
        );
        assertEquals(res.status, 200);
        const tasks = await res.json();

        const found = tasks.find(
          (t: { title: string }) =>
            t.title === "Integration Test Direct Context Task",
        );
        assertExists(found);
      },
    );

    await t.step(
      "GET /api/contexts/:id/tasks returns tasks inheriting from project",
      async () => {
        // Create context
        const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Resolution Inherit",
          timeWindows: [],
        });
        assertEquals(ctxRes.status, 201);
        const context = await ctxRes.json();

        // Create project with that context
        const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Resolution Inherit",
          contextIds: [context.id],
        });
        assertEquals(projRes.status, 201);
        const project = await projRes.json();

        // Create task in that project (no direct context — inherits from project)
        await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Inherited Context Task",
          priority: 2,
          projectId: project.id,
        });

        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/${context.id}/tasks`,
        );
        assertEquals(res.status, 200);
        const tasks = await res.json();

        const found = tasks.find(
          (t: { title: string }) =>
            t.title === "Integration Test Inherited Context Task",
        );
        assertExists(found);
      },
    );

    await t.step(
      "task with own contexts overrides project context",
      async () => {
        // Create two contexts
        const ctxARes = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Override A",
          timeWindows: [],
        });
        assertEquals(ctxARes.status, 201);
        const ctxA = await ctxARes.json();

        const ctxBRes = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Override B",
          timeWindows: [],
        });
        assertEquals(ctxBRes.status, 201);
        const ctxB = await ctxBRes.json();

        // Create project with context A
        const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Override",
          contextIds: [ctxA.id],
        });
        assertEquals(projRes.status, 201);
        const project = await projRes.json();

        // Create task with context B (overrides project's context A)
        await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Override Task",
          priority: 2,
          projectId: project.id,
          contextIds: [ctxB.id],
        });

        // Query context A — task should NOT appear (overridden)
        const resA = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/${ctxA.id}/tasks`,
        );
        const tasksA = await resA.json();
        const foundA = tasksA.find(
          (t: { title: string }) =>
            t.title === "Integration Test Override Task",
        );
        assertEquals(foundA, undefined);

        // Query context B — task SHOULD appear
        const resB = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/${ctxB.id}/tasks`,
        );
        const tasksB = await resB.json();
        const foundB = tasksB.find(
          (t: { title: string }) =>
            t.title === "Integration Test Override Task",
        );
        assertExists(foundB);
      },
    );

    await t.step(
      "multi-level inheritance: grandchild inherits from grandparent",
      async () => {
        // Create context
        const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Grandparent",
          timeWindows: [],
        });
        assertEquals(ctxRes.status, 201);
        const context = await ctxRes.json();

        // Create grandparent project with context
        const gpRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Grandparent",
          contextIds: [context.id],
        });
        assertEquals(gpRes.status, 201);
        const grandparent = await gpRes.json();

        // Create parent project (no context, child of grandparent)
        const parentRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Parent NoCtx",
          parentProjectId: grandparent.id,
        });
        assertEquals(parentRes.status, 201);
        const parent = await parentRes.json();

        // Create child project (no context, child of parent)
        const childRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Child NoCtx",
          parentProjectId: parent.id,
        });
        assertEquals(childRes.status, 201);
        const child = await childRes.json();

        // Create task in child project (should inherit grandparent's context)
        await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Integration Test Grandchild Task",
          priority: 3,
          projectId: child.id,
        });

        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/${context.id}/tasks`,
        );
        assertEquals(res.status, 200);
        const tasks = await res.json();

        const found = tasks.find(
          (t: { title: string }) =>
            t.title === "Integration Test Grandchild Task",
        );
        assertExists(found);
      },
    );

    // -----------------------------------------------------------------------
    // Section 18: Context Rank
    // -----------------------------------------------------------------------

    await t.step("PATCH /api/contexts/reorder updates sort_order", async () => {
      // Create 3 contexts
      const names = [
        "Test Context Rank A",
        "Test Context Rank B",
        "Test Context Rank C",
      ];
      const ids: string[] = [];
      for (const name of names) {
        const res = await apiCall(ctx.app, "POST", "/api/contexts", {
          name,
          timeWindows: [],
        });
        assertEquals(res.status, 201);
        ids.push((await res.json()).id);
      }

      // Reorder: C, A, B
      const reordered = [ids[2], ids[0], ids[1]];
      const reorderRes = await apiCall(
        ctx.app,
        "PATCH",
        "/api/contexts/reorder",
        { contextIds: reordered },
      );
      assertEquals(reorderRes.status, 200);

      // Verify order
      const listRes = await apiCall(ctx.app, "GET", "/api/contexts");
      assertEquals(listRes.status, 200);
      const contexts = await listRes.json();

      const rankA = contexts.find((c: { id: string }) => c.id === ids[0]);
      const rankB = contexts.find((c: { id: string }) => c.id === ids[1]);
      const rankC = contexts.find((c: { id: string }) => c.id === ids[2]);

      // C should have lowest sort_order (first), B highest (last)
      assertEquals(rankC.sort_order < rankA.sort_order, true);
      assertEquals(rankA.sort_order < rankB.sort_order, true);
    });

    await t.step("new context gets highest sort_order (last)", async () => {
      // Get current max sort_order
      const listBefore = await apiCall(ctx.app, "GET", "/api/contexts");
      const contextsBefore = await listBefore.json();
      const maxBefore = Math.max(
        ...contextsBefore.map((c: { sort_order: number }) => c.sort_order),
      );

      // Create new context
      const res = await apiCall(ctx.app, "POST", "/api/contexts", {
        name: "Test Context Rank Last",
        timeWindows: [],
      });
      assertEquals(res.status, 201);
      const newCtx = await res.json();

      assertEquals(newCtx.sort_order > maxBefore, true);
    });

    // -----------------------------------------------------------------------
    // Edge cases: validation errors and not-found paths
    // -----------------------------------------------------------------------

    await t.step(
      "PATCH /contexts/reorder with invalid body returns 400",
      async () => {
        const res = await apiCall(ctx.app, "PATCH", "/api/contexts/reorder", {
          contextIds: "not-an-array",
        });
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Validation error");
      },
    );

    await t.step(
      "GET /contexts/:id/tasks with invalid completed param returns 400",
      async () => {
        // Use a valid context id but invalid query param
        const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Tasks Validation",
          timeWindows: [],
        });
        assertEquals(ctxRes.status, 201);
        const context = await ctxRes.json();

        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/${context.id}/tasks?completed=invalid`,
        );
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Validation error");
      },
    );

    await t.step(
      "GET /contexts/:id/tasks for non-existent context returns 404",
      async () => {
        const fakeId = "00000000-0000-0000-0000-000000000000";
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/${fakeId}/tasks`,
        );
        assertEquals(res.status, 404);
        const body = await res.json();
        assertEquals(body.error, "Context not found");
      },
    );

    await t.step(
      "GET /contexts/:id/tasks with completed=true filters completed tasks",
      async () => {
        // Create context, project, and task (inherits context from project)
        const ctxRes = await apiCall(ctx.app, "POST", "/api/contexts", {
          name: "Test Context Completed Filter",
          timeWindows: [],
        });
        assertEquals(ctxRes.status, 201);
        const context = await ctxRes.json();

        const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
          name: "Test Project Completed Filter",
          contextIds: [context.id],
        });
        assertEquals(projRes.status, 201);
        const project = await projRes.json();

        // Task inheriting context from project (no direct task_contexts)
        const taskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Test Task Inherited Completed",
          priority: 2,
          projectId: project.id,
        });
        assertEquals(taskRes.status, 201);
        const task = await taskRes.json();

        // Task with direct context assignment
        const directTaskRes = await apiCall(ctx.app, "POST", "/api/tasks", {
          title: "Test Task Direct Completed",
          priority: 3,
          contextIds: [context.id],
        });
        assertEquals(directTaskRes.status, 201);
        const directTask = await directTaskRes.json();

        // Complete both tasks
        await apiCall(ctx.app, "POST", `/api/tasks/${task.id}/complete`);
        await apiCall(ctx.app, "POST", `/api/tasks/${directTask.id}/complete`);

        // completed=true should include both
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/${context.id}/tasks?completed=true`,
        );
        assertEquals(res.status, 200);
        const tasks = await res.json();
        const foundInherited = tasks.find(
          (t: { id: string }) => t.id === task.id,
        );
        const foundDirect = tasks.find(
          (t: { id: string }) => t.id === directTask.id,
        );
        assertExists(foundInherited);
        assertExists(foundDirect);

        // completed=false should NOT include either
        const res2 = await apiCall(
          ctx.app,
          "GET",
          `/api/contexts/${context.id}/tasks?completed=false`,
        );
        assertEquals(res2.status, 200);
        const tasks2 = await res2.json();
        const notFoundInherited = tasks2.find(
          (t: { id: string }) => t.id === task.id,
        );
        const notFoundDirect = tasks2.find(
          (t: { id: string }) => t.id === directTask.id,
        );
        assertEquals(notFoundInherited, undefined);
        assertEquals(notFoundDirect, undefined);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
