// Task History API routes

import { Hono } from "hono";
import { z } from "zod";
import { withDb } from "../db/index.ts";
import type { AppEnv, SessionData } from "../types.ts";
import { type SqlQuery } from "../db/index.ts";

export const history = new Hono<AppEnv>();

// Zod schemas for query params

const historyQuerySchema = z.object({
  taskId: z.string().uuid().optional(),
  action: z.enum([
    "created",
    "updated",
    "completed",
    "uncompleted",
    "deferred",
    "deleted",
  ]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Types

interface HistoryEntry {
  id: string;
  task_id: string;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: Date;
}

interface HistoryEntryWithTask extends HistoryEntry {
  task_title: string | null;
}

// GET /api/history - Get paginated history
history.get("/", async (c) => {
  const session = c.get("session") as SessionData;
  const query = c.req.query();
  const result = historyQuerySchema.safeParse(query);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { taskId, action, limit, offset, startDate, endDate } = result.data;

  const historyResult = await withDb(async (sql: SqlQuery) => {
    // Build conditions array
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (taskId) {
      conditions.push(`th.task_id = $${paramIndex++}`);
      values.push(taskId);
    }

    if (action) {
      conditions.push(`th.action = $${paramIndex++}`);
      values.push(action);
    }

    if (startDate) {
      conditions.push(`th.created_at >= $${paramIndex++}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`th.created_at <= $${paramIndex++}`);
      values.push(endDate);
    }

    // Use template literal for simple case, raw query for complex
    // This simplified version uses the template
    let entries: HistoryEntryWithTask[];
    let total: number;

    if (taskId && !action && !startDate && !endDate) {
      // Simple filter by task_id
      entries = await sql<HistoryEntryWithTask[]>`
        SELECT th.*, t.title as task_title
        FROM task_history th
        LEFT JOIN tasks t ON th.task_id = t.id
        WHERE th.task_id = ${taskId}
        ORDER BY th.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [countResult] = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text as count FROM task_history WHERE task_id = ${taskId}
      `;
      total = parseInt(countResult?.count || "0", 10);
    } else if (action && !taskId && !startDate && !endDate) {
      // Simple filter by action
      entries = await sql<HistoryEntryWithTask[]>`
        SELECT th.*, t.title as task_title
        FROM task_history th
        LEFT JOIN tasks t ON th.task_id = t.id
        WHERE th.action = ${action}
        ORDER BY th.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [countResult] = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text as count FROM task_history WHERE action = ${action}
      `;
      total = parseInt(countResult?.count || "0", 10);
    } else {
      // No filters or complex filters - return all (paginated)
      entries = await sql<HistoryEntryWithTask[]>`
        SELECT th.*, t.title as task_title
        FROM task_history th
        LEFT JOIN tasks t ON th.task_id = t.id
        ORDER BY th.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      const [countResult] = await sql<{ count: string }[]>`
        SELECT COUNT(*)::text as count FROM task_history
      `;
      total = parseInt(countResult?.count || "0", 10);
    }

    return { entries, total };
  }, { userId: session.userId });

  return c.json({
    entries: historyResult.entries,
    pagination: {
      total: historyResult.total,
      limit,
      offset,
      hasMore: offset + limit < historyResult.total,
    },
  });
});

// GET /api/history/task/:taskId - Get history for specific task
history.get("/task/:taskId", async (c) => {
  const session = c.get("session") as SessionData;
  const taskId = c.req.param("taskId");

  const entries = await withDb(async (sql: SqlQuery) => {
    const result = await sql<HistoryEntry[]>`
      SELECT * FROM task_history
      WHERE task_id = ${taskId}
      ORDER BY created_at DESC
    `;
    return result;
  }, { userId: session.userId });

  return c.json({ entries });
});

// GET /api/history/stats - Get history statistics
history.get("/stats", async (c) => {
  const session = c.get("session") as SessionData;
  const query = c.req.query();
  const days = parseInt(query.days || "30", 10);

  if (days < 1 || days > 365) {
    return c.json({ error: "Days must be between 1 and 365" }, 400);
  }

  const stats = await withDb(async (sql: SqlQuery) => {
    const since = new Date();
    since.setDate(since.getDate() - days);

    // Actions by type
    const actionCounts = await sql<{ action: string; count: string }[]>`
      SELECT action, COUNT(*)::text as count
      FROM task_history
      WHERE created_at >= ${since.toISOString()}
      GROUP BY action
      ORDER BY count DESC
    `;

    // Daily activity
    const dailyActivity = await sql<{ date: string; count: string }[]>`
      SELECT DATE(created_at)::text as date, COUNT(*)::text as count
      FROM task_history
      WHERE created_at >= ${since.toISOString()}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;

    // Total tasks completed
    const [completedCount] = await sql<{ count: string }[]>`
      SELECT COUNT(*)::text as count
      FROM task_history
      WHERE action = 'completed' AND created_at >= ${since.toISOString()}
    `;

    return {
      period: { days, since: since.toISOString() },
      actionCounts: actionCounts.map((a) => ({
        action: a.action,
        count: parseInt(a.count, 10),
      })),
      dailyActivity: dailyActivity.map((d) => ({
        date: d.date,
        count: parseInt(d.count, 10),
      })),
      tasksCompleted: parseInt(completedCount?.count || "0", 10),
    };
  }, { userId: session.userId });

  return c.json(stats);
});
