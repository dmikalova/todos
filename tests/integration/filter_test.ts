// Integration tests for Saved Filters API
// Tests: CRUD, apply filter, not-found paths, partial updates

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Filter CRUD Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    let filterId: string;
    let projectId: string;

    await t.step("setup: create project and tasks", async () => {
      const projRes = await apiCall(ctx.app, "POST", "/api/projects", {
        name: "Test Project Filters",
      });
      assertEquals(projRes.status, 201);
      projectId = (await projRes.json()).id;

      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Filter Task 1",
        projectId,
        dueDate: "2026-06-01",
      });
      await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test Filter Task 2",
        dueDate: "2026-12-01",
      });
    });

    await t.step("POST /api/filters creates filter", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/filters", {
        name: "Test Filter",
        criteria: {
          projects: [projectId],
          completed: false,
        },
      });
      assertEquals(res.status, 201);
      const body = await res.json();
      assertExists(body.id);
      assertEquals(body.name, "Test Filter");
      filterId = body.id;
    });

    await t.step("POST /api/filters returns 400 for invalid body", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/filters", {
        // missing name
        criteria: { completed: false },
      });
      assertEquals(res.status, 400);
      const body = await res.json();
      assertEquals(body.error, "Validation error");
    });

    await t.step("GET /api/filters lists filters", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/filters");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.length >= 1, true);
    });

    await t.step("GET /api/filters/:id returns single filter", async () => {
      const res = await apiCall(ctx.app, "GET", `/api/filters/${filterId}`);
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.id, filterId);
      assertEquals(body.name, "Test Filter");
    });

    await t.step(
      "GET /api/filters/:id with non-existent ID returns 404",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          "/api/filters/00000000-0000-0000-0000-000000000099",
        );
        assertEquals(res.status, 404);
      },
    );

    await t.step("PATCH /api/filters/:id updates name", async () => {
      const res = await apiCall(ctx.app, "PATCH", `/api/filters/${filterId}`, {
        name: "Updated Filter Name",
      });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.name, "Updated Filter Name");
    });

    await t.step("PATCH /api/filters/:id updates criteria", async () => {
      const res = await apiCall(ctx.app, "PATCH", `/api/filters/${filterId}`, {
        criteria: { completed: true },
      });
      assertEquals(res.status, 200);
    });

    await t.step("PATCH /api/filters/:id updates color", async () => {
      const res = await apiCall(ctx.app, "PATCH", `/api/filters/${filterId}`, {
        color: "blue",
      });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.color, "blue");
    });

    await t.step(
      "PATCH /api/filters/:id returns 400 for invalid body",
      async () => {
        const res = await apiCall(
          ctx.app,
          "PATCH",
          `/api/filters/${filterId}`,
          { name: "" }, // empty string fails min(1)
        );
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Validation error");
      },
    );

    await t.step(
      "PATCH /api/filters/:id with non-existent ID returns 404",
      async () => {
        const res = await apiCall(
          ctx.app,
          "PATCH",
          "/api/filters/00000000-0000-0000-0000-000000000099",
          { name: "Nope" },
        );
        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "POST /api/filters/:id/apply returns matching tasks",
      async () => {
        // Update filter to use project criteria
        await apiCall(ctx.app, "PATCH", `/api/filters/${filterId}`, {
          criteria: { projects: [projectId], completed: false },
        });

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/filters/${filterId}/apply`,
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        assertExists(body.filter);
        assertExists(body.tasks);
      },
    );

    await t.step(
      "POST /api/filters/:id/apply with non-existent filter returns 404",
      async () => {
        const res = await apiCall(
          ctx.app,
          "POST",
          "/api/filters/00000000-0000-0000-0000-000000000099/apply",
        );
        assertEquals(res.status, 404);
      },
    );

    await t.step(
      "POST /api/filters/:id/apply with dueDateWithin criteria",
      async () => {
        // Create a filter with relative date criteria
        const createRes = await apiCall(ctx.app, "POST", "/api/filters", {
          name: "Test Filter Date",
          criteria: {
            dueDateWithin: { amount: 30, unit: "days" },
          },
        });
        assertEquals(createRes.status, 201);
        const dateFilter = await createRes.json();

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/filters/${dateFilter.id}/apply`,
        );
        assertEquals(res.status, 200);
      },
    );

    await t.step(
      "POST /api/filters/:id/apply with dueDateWithin weeks",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/filters", {
          name: "Weeks Filter",
          criteria: {
            dueDateWithin: { amount: 2, unit: "weeks" },
          },
        });
        assertEquals(createRes.status, 201);
        const filter = await createRes.json();

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/filters/${filter.id}/apply`,
        );
        assertEquals(res.status, 200);
      },
    );

    await t.step(
      "POST /api/filters/:id/apply with dueDateWithin months",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/filters", {
          name: "Months Filter",
          criteria: {
            dueDateWithin: { amount: 3, unit: "months" },
          },
        });
        assertEquals(createRes.status, 201);
        const filter = await createRes.json();

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/filters/${filter.id}/apply`,
        );
        assertEquals(res.status, 200);
      },
    );

    await t.step(
      "POST /api/filters/:id/apply with dueDateWithin years",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/filters", {
          name: "Years Filter",
          criteria: {
            dueDateWithin: { amount: 1, unit: "years" },
          },
        });
        assertEquals(createRes.status, 201);
        const filter = await createRes.json();

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/filters/${filter.id}/apply`,
        );
        assertEquals(res.status, 200);
      },
    );

    await t.step(
      "POST /api/filters/:id/apply with priorities criteria",
      async () => {
        const createRes = await apiCall(ctx.app, "POST", "/api/filters", {
          name: "Priority Filter",
          criteria: {
            priorities: [1, 2],
          },
        });
        assertEquals(createRes.status, 201);
        const priorityFilter = await createRes.json();

        const res = await apiCall(
          ctx.app,
          "POST",
          `/api/filters/${priorityFilter.id}/apply`,
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        assertExists(body.tasks);
      },
    );

    await t.step("DELETE /api/filters/:id deletes filter", async () => {
      const res = await apiCall(ctx.app, "DELETE", `/api/filters/${filterId}`);
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.message, "Filter deleted");
    });

    await t.step(
      "DELETE /api/filters/:id with non-existent ID returns 404",
      async () => {
        const res = await apiCall(
          ctx.app,
          "DELETE",
          "/api/filters/00000000-0000-0000-0000-000000000099",
        );
        assertEquals(res.status, 404);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
