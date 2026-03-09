// Next Task API - Returns eligible tasks for client-side scoring pipeline

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb } from "../db/index.ts";
import type { AppEnv, SessionData } from "../types.ts";

export const next = new Hono<AppEnv>();

// Zod schemas

const nextQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  count: z.coerce.number().int().min(1).max(100).default(50),
});

// Types

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: Date | null;
  deferred_until: Date | null;
  project_id: string | null;
  priority: number;
  must_do: boolean;
  completed_at: Date | null;
  created_at: Date;
}

// GET /api/next - Get eligible tasks (not completed, not deleted, not deferred)
next.get("/", async (c) => {
  const session = c.get("session") as SessionData;
  const query = c.req.query();
  const result = nextQuerySchema.safeParse(query);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { projectId, count } = result.data;

  const tasks = await withDb(
    async (sql: SqlQuery) => {
      const eligibleTasks = await sql<Task[]>`
      SELECT t.*,
        r.frequency as recurrence_type,
        r.interval as recurrence_interval,
        r.days_of_week as recurrence_days
      FROM tasks t
      LEFT JOIN recurrence_rules r ON r.task_id = t.id
      WHERE t.completed_at IS NULL
        AND t.deleted_at IS NULL
        AND (t.deferred_until IS NULL OR t.deferred_until <= NOW())
        AND (t.due_date IS NULL OR t.due_date <= CURRENT_DATE)
        ${projectId ? sql`AND t.project_id = ${projectId}` : sql``}
      ORDER BY
        CASE WHEN t.due_date IS NOT NULL THEN 0 ELSE 1 END,
        t.due_date ASC NULLS LAST,
        t.created_at ASC
      LIMIT ${count}
    `;

      return {
        tasks: eligibleTasks,
        totalEligible: eligibleTasks.length,
      };
    },
    { userId: session.userId },
  );

  return c.json(tasks);
});
