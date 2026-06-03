// Integration tests for Import API
// Tests: full import merge/replace, simple task import, Todoist stub, error handling

import { assertEquals, assertExists } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Import Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    await t.step(
      "POST /api/import with merge mode imports projects and tasks",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
          version: "1.0",
          projects: [{ name: "Test Project Imported" }],
          tasks: [
            { title: "Integration Test Imported Task 1" },
            { title: "Integration Test Imported Task 2" },
          ],
        });
        const body = await res.json();
        assertEquals(body.success, true);
        assertEquals(body.imported.projects, 1);
        assertEquals(body.imported.tasks, 2);
      },
    );

    await t.step("merge mode skips duplicate projects", async () => {
      const res = await apiCall(
        ctx.app,
        "POST",
        "/api/import?mode=merge&skipDuplicates=true",
        {
          projects: [{ name: "Test Project Imported" }],
        },
      );
      const body = await res.json();
      assertEquals(body.skipped.projects, 1);
    });

    await t.step(
      "merge mode skip duplicate tasks fails for null project_id",
      async () => {
        // Known bug: postgres.js can't determine type of null parameter in
        // (project_id = $1 OR (project_id IS NULL AND $1 IS NULL))
        const res = await apiCall(
          ctx.app,
          "POST",
          "/api/import?mode=merge&skipDuplicates=true",
          {
            tasks: [{ title: "Integration Test Imported Task 1" }],
          },
        );
        const body = await res.json();
        assertEquals(body.success, false);
        assertEquals(body.errors.length > 0, true);
      },
    );

    await t.step(
      "POST /api/import with replace mode clears and imports",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/import?mode=replace", {
          projects: [{ name: "Test Project Replaced" }],
          tasks: [{ title: "Integration Test Replaced Task" }],
        });
        const body = await res.json();
        assertEquals(body.success, true);
        assertEquals(body.imported.projects, 1);
        assertEquals(body.imported.tasks, 1);
      },
    );

    await t.step("POST /api/import/tasks imports simple tasks", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/import/tasks", {
        tasks: [
          { title: "Integration Test Simple Import 1" },
          { title: "Integration Test Simple Import 2" },
          {
            title: "Integration Test Simple Import 3",
            description: "With desc",
            due_date: "2026-06-01T00:00:00Z",
          },
        ],
      });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.success, true);
      assertEquals(body.imported, 3);
      assertEquals(body.failed, 0);
    });

    await t.step(
      "POST /api/import/tasks with invalid format returns 400",
      async () => {
        const res = await apiCall(ctx.app, "POST", "/api/import/tasks", {
          tasks: [{ notATitle: "bad" }],
        });
        assertEquals(res.status, 400);
      },
    );

    await t.step("POST /api/import/todoist returns 501", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/import/todoist", {});
      assertEquals(res.status, 501);
      const body = await res.json();
      assertExists(body.error);
    });

    await t.step("POST /api/import with invalid data returns 400", async () => {
      const res = await apiCall(ctx.app, "POST", "/api/import", {
        tasks: [{ title: 12345 }], // title should be string
      });
      assertEquals(res.status, 400);
      const body = await res.json();
      assertEquals(body.error, "Invalid import data");
    });

    await t.step(
      "POST /api/import with project_id mapping via provided IDs",
      async () => {
        const projectId = "00000000-0000-4000-8000-000000000099";
        const res = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
          projects: [{ id: projectId, name: "Test Project Import Mapping" }],
          tasks: [
            {
              title: "Integration Test Mapped Task",
              project_id: projectId,
            },
          ],
        });
        const body = await res.json();
        assertEquals(body.success, true);
        assertEquals(body.imported.projects, 1);
        assertEquals(body.imported.tasks, 1);
      },
    );

    await t.step(
      "POST /api/import with bad FK reference fails transaction",
      async () => {
        // A non-existent project_id FK causes the entire transaction to fail
        const res = await apiCall(ctx.app, "POST", "/api/import?mode=merge", {
          tasks: [
            {
              title: "Integration Test Task With Bad Project Ref",
              project_id: "00000000-0000-4000-8000-ffffffffffff",
            },
          ],
        });
        const body = await res.json();
        // Transaction fails completely - success is false
        assertEquals(body.success, false);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
