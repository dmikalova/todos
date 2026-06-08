// Contexts API routes

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb, withTransaction } from "../db/index.ts";
import type { AppEnv, SessionData } from "../types.ts";

export const contexts = new Hono<AppEnv>();

// Zod schemas

const timeWindowSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const createContextSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
  timeWindows: z.array(timeWindowSchema).default([]),
});

const updateContextSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  timeWindows: z.array(timeWindowSchema).optional(),
});

// Types

interface Context {
  id: string;
  user_id: string;
  name: string;
  color?: string;
  created_at: Date;
}

interface TimeWindow {
  id: string;
  context_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface ContextWithWindows extends Context {
  time_windows: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }[];
}

// Helper to get context with time windows
async function getContextWithWindows(
  sql: SqlQuery,
  contextId: string,
): Promise<ContextWithWindows | null> {
  const [context] = await sql<Context[]>`
    SELECT * FROM contexts WHERE id = ${contextId}
  `;
  if (!context) return null;

  const windows = await sql<TimeWindow[]>`
    SELECT * FROM context_time_windows WHERE context_id = ${contextId}
    ORDER BY day_of_week, start_time
  `;

  return {
    ...context,
    time_windows: windows.map((w) => ({
      dayOfWeek: w.day_of_week,
      startTime: w.start_time,
      endTime: w.end_time,
    })),
  };
}

// POST /api/contexts - Create context
contexts.post("/", async (c) => {
  const session = c.get("session") as SessionData;
  const body = await c.req.json();
  const result = createContextSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { name, color, timeWindows } = result.data;

  const context = await withTransaction(async (tx) => {
    const [created] = await tx<Context[]>`
      INSERT INTO contexts (user_id, name, color, sort_order)
      VALUES (${session.userId}, ${name}, ${color ?? null}, (
        SELECT COALESCE(MAX(sort_order), 0) + 1 FROM contexts WHERE user_id = ${session.userId}
      ))
      RETURNING *
    `;

    // Add time windows
    for (const window of timeWindows) {
      await tx`
        INSERT INTO context_time_windows (context_id, day_of_week, start_time, end_time)
        VALUES (${created.id}, ${window.dayOfWeek}, ${window.startTime}, ${window.endTime})
      `;
    }

    return {
      ...created,
      time_windows: timeWindows,
    };
  }, { userId: session.userId });

  return c.json(context, 201);
});

// GET /api/contexts - List all contexts
contexts.get("/", async (c) => {
  const session = c.get("session") as SessionData;

  const contextList = await withDb(async (sql: SqlQuery) => {
    const allContexts = await sql<Context[]>`
      SELECT * FROM contexts ORDER BY sort_order, created_at
    `;

    const result: ContextWithWindows[] = [];
    for (const ctx of allContexts) {
      const windows = await sql<TimeWindow[]>`
        SELECT * FROM context_time_windows WHERE context_id = ${ctx.id}
        ORDER BY day_of_week, start_time
      `;
      result.push({
        ...ctx,
        time_windows: windows.map((w) => ({
          dayOfWeek: w.day_of_week,
          startTime: w.start_time,
          endTime: w.end_time,
        })),
      });
    }

    return result;
  }, { userId: session.userId });

  return c.json(contextList);
});

// PATCH /api/contexts/reorder - Reorder contexts by rank
const reorderSchema = z.object({
  contextIds: z.array(z.string().uuid()).min(1),
});

contexts.patch("/reorder", async (c) => {
  const session = c.get("session") as SessionData;
  const body = await c.req.json();
  const result = reorderSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { contextIds } = result.data;

  await withTransaction(
    async (tx) => {
      for (let i = 0; i < contextIds.length; i++) {
        await tx`
          UPDATE contexts SET sort_order = ${i + 1}
          WHERE id = ${contextIds[i]}
        `;
      }
    },
    { userId: session.userId },
  );

  return c.json({ message: "Contexts reordered" });
});

// GET /api/contexts/:id - Get single context
contexts.get("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const context = await withDb((sql: SqlQuery) => {
    return getContextWithWindows(sql, id);
  }, { userId: session.userId });

  if (!context) {
    return c.json({ error: "Context not found" }, 404);
  }

  return c.json(context);
});

// PATCH /api/contexts/:id - Update context
contexts.patch("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");
  const body = await c.req.json();
  const result = updateContextSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const updates = result.data;

  const context = await withTransaction(async (tx) => {
    const [existing] = await tx<
      Context[]
    >`SELECT * FROM contexts WHERE id = ${id}`;
    if (!existing) return null;

    // Update name if provided
    if (updates.name) {
      await tx`UPDATE contexts SET name = ${updates.name} WHERE id = ${id}`;
    }

    // Update color if provided
    if (updates.color !== undefined) {
      await tx`UPDATE contexts SET color = ${updates.color} WHERE id = ${id}`;
    }

    // Replace time windows if provided
    if (updates.timeWindows !== undefined) {
      await tx`DELETE FROM context_time_windows WHERE context_id = ${id}`;
      for (const window of updates.timeWindows) {
        await tx`
          INSERT INTO context_time_windows (context_id, day_of_week, start_time, end_time)
          VALUES (${id}, ${window.dayOfWeek}, ${window.startTime}, ${window.endTime})
        `;
      }
    }

    // Get updated context
    const [updated]: Context[] =
      await tx`SELECT * FROM contexts WHERE id = ${id}`;
    const windows: TimeWindow[] = await tx`
      SELECT * FROM context_time_windows WHERE context_id = ${id}
      ORDER BY day_of_week, start_time
    `;

    return {
      ...updated,
      time_windows: windows.map((w: TimeWindow) => ({
        dayOfWeek: w.day_of_week,
        startTime: w.start_time,
        endTime: w.end_time,
      })),
    };
  }, { userId: session.userId });

  if (!context) {
    return c.json({ error: "Context not found" }, 404);
  }

  return c.json(context);
});

// DELETE /api/contexts/:id - Delete context
contexts.delete("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const deleted = await withTransaction(async (tx) => {
    const [existing] = await tx<
      Context[]
    >`SELECT * FROM contexts WHERE id = ${id}`;
    if (!existing) return null;

    // Cascade delete removes time windows, project_contexts, and task_contexts
    await tx`DELETE FROM contexts WHERE id = ${id}`;
    return existing;
  }, { userId: session.userId });

  if (!deleted) {
    return c.json({ error: "Context not found" }, 404);
  }

  return c.json({ message: "Context deleted", context: deleted });
});

// GET /api/contexts/:id/tasks - Get tasks with effective context
const contextTasksSchema = z.object({
  completed: z.enum(["true", "false"]).optional(),
});

contexts.get("/:id/tasks", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const params = contextTasksSchema.safeParse(query);

  if (!params.success) {
    return c.json(
      { error: "Validation error", details: params.error.issues },
      400,
    );
  }

  const { completed } = params.data;

  // Verify context belongs to user
  const contextExists = await withDb(
    async (sql: SqlQuery) => {
      const [ctx] = await sql<
        Context[]
      >`SELECT id FROM contexts WHERE id = ${id}`;
      return !!ctx;
    },
    { userId: session.userId },
  );

  if (!contextExists) {
    return c.json({ error: "Context not found" }, 404);
  }

  const tasks = await withDb(
    async (sql: SqlQuery) => {
      // Recursive CTE: find all projects that effectively have this context
      const result = await sql`
        WITH RECURSIVE ctx_projects AS (
          SELECT p.id FROM projects p
          JOIN project_contexts pc ON pc.project_id = p.id
          WHERE pc.context_id = ${id}
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
          -- Tasks with direct context assignment
          SELECT t.* FROM tasks t
          JOIN task_contexts tc ON tc.task_id = t.id
          WHERE tc.context_id = ${id}
            AND t.deleted_at IS NULL
            ${
        completed === "true" ? sql`AND t.completed_at IS NOT NULL` : sql``
      }
            ${completed === "false" ? sql`AND t.completed_at IS NULL` : sql``}
          UNION
          -- Tasks inheriting from project (no direct task contexts)
          SELECT t.* FROM tasks t
          WHERE t.project_id IN (SELECT id FROM ctx_projects)
            AND NOT EXISTS (SELECT 1 FROM task_contexts tc WHERE tc.task_id = t.id)
            AND t.deleted_at IS NULL
            ${
        completed === "true" ? sql`AND t.completed_at IS NOT NULL` : sql``
      }
            ${completed === "false" ? sql`AND t.completed_at IS NULL` : sql``}
        ) t
        LEFT JOIN task_contexts tc2 ON t.id = tc2.task_id
        GROUP BY t.id, t.user_id, t.title, t.project_id, t.priority,
                 t.due_date, t.deferred_until, t.completed_at, t.deleted_at,
                 t.created_at, t.updated_at
        ORDER BY t.priority DESC, t.due_date ASC NULLS LAST, t.title ASC
      `;
      return result;
    },
    { userId: session.userId },
  );

  return c.json(tasks);
});
