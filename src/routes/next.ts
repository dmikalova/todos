// Next Task API - Returns the single next task based on context rank + priority

import { Hono } from "hono";
import { type SqlQuery, withDb, withTransaction } from "../db/index.ts";
import type { AppEnv, SessionData } from "../types.ts";

export const next = new Hono<AppEnv>();

// Types

interface NextTask {
  id: string;
  title: string;
  due_date: string | null;
  deferred_until: Date | null;
  project_id: string | null;
  priority: number;
  completed_at: Date | null;
  created_at: Date;
  context_ids: string[];
}

interface ActiveContext {
  id: string;
  name: string;
  sort_order: number;
}

// GET /api/next - Get the next task (stable selection)
next.get("/", async (c) => {
  const session = c.get("session") as SessionData;

  // Get user timezone for date/time comparisons
  const [userSettings] = await withDb(
    async (sql: SqlQuery) => {
      return await sql<{ timezone: string }[]>`
        SELECT timezone FROM user_settings WHERE user_id = ${session.userId}
      `;
    },
    { userId: session.userId },
  );
  const tz = userSettings?.timezone || "UTC";

  // Check if we have a current stable selection that's still eligible
  const currentSelection = await withDb(
    async (sql: SqlQuery) => {
      const [sel] = await sql<{ task_id: string | null }[]>`
        SELECT task_id FROM user_next_selection WHERE user_id = ${session.userId}
      `;
      if (!sel?.task_id) return null;

      // Verify the task is still eligible
      const [task] = await sql<NextTask[]>`
        SELECT t.*,
          COALESCE(array_agg(tc.context_id) FILTER (WHERE tc.context_id IS NOT NULL), '{}') as context_ids
        FROM tasks t
        LEFT JOIN task_contexts tc ON t.id = tc.task_id
        WHERE t.id = ${sel.task_id}
          AND t.completed_at IS NULL
          AND t.deleted_at IS NULL
          AND (t.deferred_until IS NULL OR t.deferred_until <= NOW())
          AND (t.due_date IS NULL OR t.due_date <= (NOW() AT TIME ZONE ${tz})::date)
        GROUP BY t.id
      `;
      return task || null;
    },
    { userId: session.userId },
  );

  if (currentSelection) {
    return c.json({ task: currentSelection });
  }

  // No valid current selection — pick a new one
  // Step 1: Find active contexts (no time windows = always active, or time window matches now)
  const activeContexts = await withDb(
    async (sql: SqlQuery) => {
      const result = await sql<ActiveContext[]>`
        SELECT c.id, c.name, c.sort_order
        FROM contexts c
        WHERE NOT EXISTS (
          SELECT 1 FROM context_time_windows tw WHERE tw.context_id = c.id
        )
        UNION
        SELECT DISTINCT c.id, c.name, c.sort_order
        FROM contexts c
        JOIN context_time_windows tw ON tw.context_id = c.id
        WHERE tw.day_of_week = EXTRACT(DOW FROM NOW() AT TIME ZONE ${tz})::int
          AND tw.start_time <= (NOW() AT TIME ZONE ${tz})::time
          AND tw.end_time > (NOW() AT TIME ZONE ${tz})::time
        ORDER BY sort_order ASC
      `;
      return result;
    },
    { userId: session.userId },
  );

  if (activeContexts.length === 0) {
    return c.json({ task: null });
  }

  // Step 2: Iterate contexts by rank, find first with eligible tasks
  let selectedTask: NextTask | null = null;

  for (const context of activeContexts) {
    const task = await withDb(
      async (sql: SqlQuery) => {
        // Get eligible tasks for this context using CTE inheritance
        const tasks = await sql<NextTask[]>`
          WITH RECURSIVE ctx_projects AS (
            SELECT p.id FROM projects p
            JOIN project_contexts pc ON pc.project_id = p.id
            WHERE pc.context_id = ${context.id}
            UNION
            SELECT child.id FROM projects child
            JOIN ctx_projects parent ON child.parent_project_id = parent.id
            WHERE NOT EXISTS (
              SELECT 1 FROM project_contexts pc WHERE pc.project_id = child.id
            )
          )
          SELECT t.*,
            COALESCE(array_agg(tc2.context_id) FILTER (WHERE tc2.context_id IS NOT NULL), '{}') as context_ids
          FROM (
            SELECT t.* FROM tasks t
            JOIN task_contexts tc ON tc.task_id = t.id
            WHERE tc.context_id = ${context.id}
              AND t.completed_at IS NULL
              AND t.deleted_at IS NULL
              AND (t.deferred_until IS NULL OR t.deferred_until <= NOW())
              AND (t.due_date IS NULL OR t.due_date <= (NOW() AT TIME ZONE ${tz})::date)
            UNION
            SELECT t.* FROM tasks t
            WHERE t.project_id IN (SELECT id FROM ctx_projects)
              AND NOT EXISTS (SELECT 1 FROM task_contexts tc WHERE tc.task_id = t.id)
              AND t.completed_at IS NULL
              AND t.deleted_at IS NULL
              AND (t.deferred_until IS NULL OR t.deferred_until <= NOW())
              AND (t.due_date IS NULL OR t.due_date <= (NOW() AT TIME ZONE ${tz})::date)
          ) t
          LEFT JOIN task_contexts tc2 ON t.id = tc2.task_id
          GROUP BY t.id, t.user_id, t.title, t.project_id, t.priority,
                   t.due_date, t.deferred_until, t.completed_at, t.deleted_at,
                   t.created_at, t.updated_at
          ORDER BY t.priority DESC
        `;

        if (tasks.length === 0) return null;

        // Group by highest priority, pick random from that group
        const highestPriority = tasks[0].priority;
        const topGroup = tasks.filter((t) => t.priority === highestPriority);
        const randomIndex = Math.floor(Math.random() * topGroup.length);
        return topGroup[randomIndex];
      },
      { userId: session.userId },
    );

    if (task) {
      selectedTask = task;
      break;
    }
  }

  if (!selectedTask) {
    return c.json({ task: null });
  }

  // Step 3: Persist the selection for stability
  await withTransaction(
    async (tx) => {
      await tx`
        INSERT INTO user_next_selection (user_id, task_id, selected_at)
        VALUES (${session.userId}, ${selectedTask!.id}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET task_id = ${
        selectedTask!.id
      }, selected_at = NOW()
      `;
    },
    { userId: session.userId },
  );

  return c.json({ task: selectedTask });
});
