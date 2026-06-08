// Saved Filters API routes

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb } from "../db/index.ts";
import type { AppEnv, SessionData } from "../types.ts";

export const filters = new Hono<AppEnv>();

// Zod schemas

const dueDateWithinSchema = z.object({
  amount: z.number().int(),
  unit: z.enum(["days", "weeks", "months", "years"]),
});

const filterCriteriaSchema = z.object({
  contexts: z.array(z.string().uuid()).optional(),
  projects: z.array(z.string().uuid()).optional(),
  priorities: z.array(z.number().int().min(1).max(4)).optional(),
  dueDateWithin: dueDateWithinSchema.optional(),
  tags: z.array(z.string()).optional(),
  completed: z.boolean().optional(),
  hasRecurrence: z.boolean().optional(),
});

const createFilterSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().max(20).optional(),
  criteria: filterCriteriaSchema,
});

const updateFilterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().max(20).nullable().optional(),
  criteria: filterCriteriaSchema.optional(),
});

// Types

interface SavedFilter {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  filter: Record<string, unknown>;
  created_at: Date;
}

// POST /api/filters - Create saved filter
filters.post("/", async (c) => {
  const session = c.get("session") as SessionData;
  const body = await c.req.json();
  const result = createFilterSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { name, color, criteria } = result.data;

  const filter = await withDb(
    async (sql: SqlQuery) => {
      const [created] = await sql<SavedFilter[]>`
      INSERT INTO saved_filters (user_id, name, color, filter)
      VALUES (${session.userId}, ${name}, ${color ?? null}, ${
        sql.json(criteria)
      })
      RETURNING *
    `;
      return created;
    },
    { userId: session.userId },
  );

  return c.json(filter, 201);
});

// GET /api/filters - List user's saved filters
filters.get("/", async (c) => {
  const session = c.get("session") as SessionData;

  const filterList = await withDb(
    async (sql: SqlQuery) => {
      const result = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters
      WHERE user_id = ${session.userId}
      ORDER BY name
    `;
      return result;
    },
    { userId: session.userId },
  );

  return c.json(filterList);
});

// GET /api/filters/:id - Get single filter
filters.get("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const filter = await withDb(
    async (sql: SqlQuery) => {
      const [result] = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters
      WHERE id = ${id} AND user_id = ${session.userId}
    `;
      return result || null;
    },
    { userId: session.userId },
  );

  if (!filter) {
    return c.json({ error: "Filter not found" }, 404);
  }

  return c.json(filter);
});

// PATCH /api/filters/:id - Update filter
filters.patch("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");
  const body = await c.req.json();
  const result = updateFilterSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const updates = result.data;

  const filter = await withDb(
    async (sql: SqlQuery) => {
      const [existing] = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters WHERE id = ${id} AND user_id = ${session.userId}
    `;
      if (!existing) return null;

      const [updated] = await sql<SavedFilter[]>`
      UPDATE saved_filters SET
        name = COALESCE(${updates.name ?? null}, name),
        color = ${updates.color !== undefined ? updates.color : existing.color},
        filter = COALESCE(${
        updates.criteria ? sql.json(updates.criteria) : null
      }, filter)
      WHERE id = ${id}
      RETURNING *
    `;
      return updated;
    },
    { userId: session.userId },
  );

  if (!filter) {
    return c.json({ error: "Filter not found" }, 404);
  }

  return c.json(filter);
});

// DELETE /api/filters/:id - Delete filter
filters.delete("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const deleted = await withDb(
    async (sql: SqlQuery) => {
      const [existing] = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters WHERE id = ${id} AND user_id = ${session.userId}
    `;
      if (!existing) return null;

      await sql`DELETE FROM saved_filters WHERE id = ${id}`;
      return existing;
    },
    { userId: session.userId },
  );

  if (!deleted) {
    return c.json({ error: "Filter not found" }, 404);
  }

  return c.json({ message: "Filter deleted", filter: deleted });
});

// POST /api/filters/:id/apply - Apply filter and get matching tasks
filters.post("/:id/apply", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const result = await withDb(
    async (sql: SqlQuery) => {
      const [filter] = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters WHERE id = ${id} AND user_id = ${session.userId}
    `;
      if (!filter) return null;

      const criteria = filter.filter as {
        contexts?: string[];
        projects?: string[];
        priorities?: number[];
        dueDateWithin?: { amount: number; unit: string };
        tags?: string[];
        completed?: boolean;
        hasRecurrence?: boolean;
      };

      // Build dynamic query based on criteria
      interface TaskRow {
        id: string;
        title: string;
        priority: number;
        due_date: Date | null;
        completed_at: Date | null;
        project_id: string | null;
      }

      const taskRows = await sql<TaskRow[]>`
      SELECT t.*
      FROM tasks t
      WHERE t.deleted_at IS NULL
      ORDER BY t.due_date NULLS LAST, t.created_at DESC
    `;

      // Copy to mutable array for filtering
      let tasks: TaskRow[] = [...taskRows];

      // Apply filters in memory
      if (criteria.projects && criteria.projects.length > 0) {
        tasks = tasks.filter((t) =>
          criteria.projects!.includes(t.project_id || "")
        );
      }

      if (criteria.priorities && criteria.priorities.length > 0) {
        tasks = tasks.filter((t) => criteria.priorities!.includes(t.priority));
      }

      if (criteria.completed !== undefined) {
        tasks = tasks.filter(
          (t) => (t.completed_at !== null) === criteria.completed,
        );
      }

      if (criteria.dueDateWithin) {
        const cutoff = computeCutoffDate(criteria.dueDateWithin);
        tasks = tasks.filter((t) => {
          return t.due_date && new Date(t.due_date) <= cutoff;
        });
      }

      return { filter, tasks };
    },
    { userId: session.userId },
  );

  if (!result) {
    return c.json({ error: "Filter not found" }, 404);
  }

  return c.json(result);
});

/** Compute a cutoff date from a relative duration. amount=0 with unit=days means end of today. */
function computeCutoffDate(within: { amount: number; unit: string }): Date {
  const now = new Date();
  const cutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  switch (within.unit) {
    case "days":
      cutoff.setDate(cutoff.getDate() + within.amount);
      break;
    case "weeks":
      cutoff.setDate(cutoff.getDate() + within.amount * 7);
      break;
    case "months":
      cutoff.setMonth(cutoff.getMonth() + within.amount);
      break;
    case "years":
      cutoff.setFullYear(cutoff.getFullYear() + within.amount);
      break;
  }
  return cutoff;
}
