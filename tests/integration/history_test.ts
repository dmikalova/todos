// Integration tests for History API
// Tests: paginated history, task-specific history, stats, action filtering

import { assertEquals, assertExists } from "@std/assert";
import { withTransaction } from "../../src/db/client.ts";
import type { SqlQuery } from "../../src/db/client.ts";
import { logTaskActionTx } from "../../src/services/history.ts";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "History Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    let taskId: string;

    await t.step("setup: create and complete tasks for history", async () => {
      // Create a task (generates 'created' history entry)
      const createRes = await apiCall(ctx.app, "POST", "/api/tasks", {
        title: "Integration Test History Task",
      });
      assertEquals(createRes.status, 201);
      const task = await createRes.json();
      taskId = task.id;

      // Update it (generates 'updated' history entry)
      await apiCall(ctx.app, "PATCH", `/api/tasks/${taskId}`, {
        title: "Integration Test History Task Updated",
      });

      // Complete it (generates 'completed' history entry)
      await apiCall(ctx.app, "POST", `/api/tasks/${taskId}/complete`);
    });

    await t.step("GET /api/history returns paginated history", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/history?limit=10");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.entries);
      assertExists(body.pagination);
      assertEquals(typeof body.pagination.total, "number");
      assertEquals(body.pagination.limit, 10);
      assertEquals(typeof body.pagination.hasMore, "boolean");
    });

    await t.step(
      "GET /api/history with offset returns paginated results",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          "/api/history?limit=1&offset=0",
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.entries.length <= 1, true);
      },
    );

    await t.step(
      "GET /api/history with taskId filter returns filtered results",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/history?taskId=${taskId}`,
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        for (const entry of body.entries as { task_id: string }[]) {
          assertEquals(entry.task_id, taskId);
        }
      },
    );

    await t.step(
      "GET /api/history with action filter returns filtered results",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          "/api/history?action=completed",
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        for (const entry of body.entries as { action: string }[]) {
          assertEquals(entry.action, "completed");
        }
      },
    );

    await t.step(
      "GET /api/history returns 400 for invalid query params",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          "/api/history?action=invalid_action",
        );
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Validation error");
      },
    );

    await t.step(
      "GET /api/history with startDate and endDate filters",
      async () => {
        const now = new Date();
        const pastDate = new Date(now);
        pastDate.setDate(pastDate.getDate() - 1);
        const futureDate = new Date(now);
        futureDate.setDate(futureDate.getDate() + 1);

        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/history?startDate=${pastDate.toISOString()}&endDate=${futureDate.toISOString()}`,
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        assertExists(body.entries);
        assertExists(body.pagination);
      },
    );

    await t.step(
      "GET /api/history/task/:taskId returns task-specific history",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/history/task/${taskId}`,
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        assertExists(body.entries);
        assertEquals(body.entries.length >= 3, true); // created, updated, completed
      },
    );

    await t.step(
      "GET /api/history with combined taskId+action filters",
      async () => {
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/history?taskId=${taskId}&action=completed`,
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        assertExists(body.entries);
        assertExists(body.pagination);
      },
    );

    await t.step("GET /api/history/stats returns stats", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/history/stats?days=30");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertExists(body.period);
      assertExists(body.actionCounts);
      assertExists(body.dailyActivity);
      assertEquals(typeof body.tasksCompleted, "number");
    });

    await t.step(
      "GET /api/history/stats without days uses default",
      async () => {
        const res = await apiCall(ctx.app, "GET", "/api/history/stats");
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.period.days, 30);
      },
    );

    await t.step("GET /api/history/stats validates days range", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/history/stats?days=0");
      assertEquals(res.status, 400);

      const res2 = await apiCall(ctx.app, "GET", "/api/history/stats?days=999");
      assertEquals(res2.status, 400);
    });

    await t.step("GET /api/history/stats with various day ranges", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/history/stats?days=7");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.period.days, 7);

      const res2 = await apiCall(ctx.app, "GET", "/api/history/stats?days=365");
      assertEquals(res2.status, 200);
    });

    await t.step(
      "logTaskActionTx works without details (uses {} fallback)",
      async () => {
        await withTransaction(async (sql: SqlQuery) => {
          await logTaskActionTx(sql, {
            taskId: taskId,
            userId: "00000000-0000-0000-0000-000000000001",
            action: "updated",
            // No details field — triggers the || {} branch
          });
        }, { userId: "00000000-0000-0000-0000-000000000001" });

        // Verify it was logged
        const res = await apiCall(
          ctx.app,
          "GET",
          `/api/history/task/${taskId}`,
        );
        assertEquals(res.status, 200);
        const body = await res.json();
        // Should have an entry with empty object details
        const emptyDetailsEntry = body.entries.find(
          (e: { details: string }) => e.details === "{}",
        );
        assertExists(emptyDetailsEntry);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
