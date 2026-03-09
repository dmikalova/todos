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
      INSERT INTO contexts (user_id, name, color) VALUES (${session.userId}, ${name}, ${
      color ?? null
    }) RETURNING *
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
      SELECT * FROM contexts ORDER BY name
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

    // Cascade delete removes time windows automatically
    // Also clear context_id from projects that reference this context
    await tx`UPDATE projects SET context_id = NULL WHERE context_id = ${id}`;
    await tx`DELETE FROM contexts WHERE id = ${id}`;
    return existing;
  }, { userId: session.userId });

  if (!deleted) {
    return c.json({ error: "Context not found" }, 404);
  }

  return c.json({ message: "Context deleted", context: deleted });
});
