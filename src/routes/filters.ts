// Saved Filters API routes

import { Hono } from "hono";
import { z } from "zod";
import { withDb } from "../db/index.ts";
import type { AppEnv, SessionData } from "../types.ts";
import { type SqlQuery } from "../db/index.ts";

export const filters = new Hono<AppEnv>();

// Zod schemas

const filterCriteriaSchema = z.object({
  contexts: z.array(z.string().uuid()).optional(),
  projects: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  completed: z.boolean().optional(),
  hasRecurrence: z.boolean().optional(),
});

const createFilterSchema = z.object({
  name: z.string().min(1).max(100),
  criteria: filterCriteriaSchema,
});

const updateFilterSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  criteria: filterCriteriaSchema.optional(),
});

// Types

interface SavedFilter {
  id: string;
  user_id: string;
  name: string;
  criteria: Record<string, unknown>;
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

  const { name, criteria } = result.data;

  const filter = await withDb(async (sql: SqlQuery) => {
    const [created] = await sql<SavedFilter[]>`
      INSERT INTO saved_filters (user_id, name, criteria)
      VALUES (${session.userId}, ${name}, ${sql.json(criteria)})
      RETURNING *
    `;
    return created;
  });

  return c.json(filter, 201);
});

// GET /api/filters - List user's saved filters
filters.get("/", async (c) => {
  const session = c.get("session") as SessionData;

  const filterList = await withDb(async (sql: SqlQuery) => {
    const result = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters
      WHERE user_id = ${session.userId}
      ORDER BY name
    `;
    return result;
  });

  return c.json(filterList);
});

// GET /api/filters/:id - Get single filter
filters.get("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const filter = await withDb(async (sql: SqlQuery) => {
    const [result] = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters
      WHERE id = ${id} AND user_id = ${session.userId}
    `;
    return result || null;
  });

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

  const filter = await withDb(async (sql: SqlQuery) => {
    const [existing] = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters WHERE id = ${id} AND user_id = ${session.userId}
    `;
    if (!existing) return null;

    const [updated] = await sql<SavedFilter[]>`
      UPDATE saved_filters SET
        name = COALESCE(${updates.name ?? null}, name),
        criteria = COALESCE(${
      updates.criteria ? sql.json(updates.criteria) : null
    }, criteria)
      WHERE id = ${id}
      RETURNING *
    `;
    return updated;
  });

  if (!filter) {
    return c.json({ error: "Filter not found" }, 404);
  }

  return c.json(filter);
});

// DELETE /api/filters/:id - Delete filter
filters.delete("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const deleted = await withDb(async (sql: SqlQuery) => {
    const [existing] = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters WHERE id = ${id} AND user_id = ${session.userId}
    `;
    if (!existing) return null;

    await sql`DELETE FROM saved_filters WHERE id = ${id}`;
    return existing;
  });

  if (!deleted) {
    return c.json({ error: "Filter not found" }, 404);
  }

  return c.json({ message: "Filter deleted", filter: deleted });
});

// POST /api/filters/:id/apply - Apply filter and get matching tasks
filters.post("/:id/apply", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const result = await withDb(async (sql: SqlQuery) => {
    const [filter] = await sql<SavedFilter[]>`
      SELECT * FROM saved_filters WHERE id = ${id} AND user_id = ${session.userId}
    `;
    if (!filter) return null;

    const criteria = filter.criteria as {
      contexts?: string[];
      projects?: string[];
      tags?: string[];
      dueBefore?: string;
      dueAfter?: string;
      completed?: boolean;
      hasRecurrence?: boolean;
    };

    // Build dynamic query based on criteria
    // This is a simplified version - in production you'd want a query builder
    interface TaskRow {
      id: string;
      title: string;
      due_date: Date | null;
      completed_at: Date | null;
      project_id: string | null;
      context_ids: string[] | null;
    }

    const taskRows = await sql<TaskRow[]>`
      SELECT t.*, 
        ARRAY_AGG(DISTINCT tc.context_id) FILTER (WHERE tc.context_id IS NOT NULL) as context_ids 
      FROM tasks t
      LEFT JOIN task_contexts tc ON t.id = tc.task_id
      WHERE t.deleted_at IS NULL
      GROUP BY t.id
      ORDER BY t.due_date NULLS LAST, t.created_at DESC
    `;

    // Copy to mutable array for filtering
    let tasks: TaskRow[] = [...taskRows];

    // Apply filters in memory for now (can be optimized with dynamic SQL later)
    if (criteria.contexts && criteria.contexts.length > 0) {
      tasks = tasks.filter((t) => {
        const contextIds = t.context_ids || [];
        return criteria.contexts!.some((c) => contextIds.includes(c));
      });
    }

    if (criteria.projects && criteria.projects.length > 0) {
      tasks = tasks.filter((t) =>
        criteria.projects!.includes(t.project_id || "")
      );
    }

    if (criteria.completed !== undefined) {
      tasks = tasks.filter(
        (t) => (t.completed_at !== null) === criteria.completed,
      );
    }

    if (criteria.dueBefore) {
      const before = new Date(criteria.dueBefore);
      tasks = tasks.filter((t) => {
        return t.due_date && new Date(t.due_date) <= before;
      });
    }

    if (criteria.dueAfter) {
      const after = new Date(criteria.dueAfter);
      tasks = tasks.filter((t) => {
        return t.due_date && new Date(t.due_date) >= after;
      });
    }

    return { filter, tasks };
  });

  if (!result) {
    return c.json({ error: "Filter not found" }, 404);
  }

  return c.json(result);
});
