// Projects API routes

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb, withTransaction } from "../db/index.ts";
import { assertOwnership } from "../services/ownership.ts";
import type { AppEnv, SessionData } from "../types.ts";

export const projects = new Hono<AppEnv>();

// Zod schemas

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  color: z.string().optional(),
  contextIds: z.array(z.string().uuid()).optional().default([]),
  parentProjectId: z.string().uuid().optional().nullable(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  color: z.string().optional().nullable(),
  contextIds: z.array(z.string().uuid()).optional(),
  parentProjectId: z.string().uuid().optional().nullable(),
  sortOrder: z.number().int().optional(),
});

// Types

interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  parent_project_id: string | null;
  sort_order: number;
  created_at: Date;
  context_ids: string[];
}

interface ProjectWithCount extends Project {
  task_count: number;
}

// POST /api/projects - Create project
projects.post("/", async (c) => {
  const session = c.get("session") as SessionData;
  const body = await c.req.json();
  const result = createProjectSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { name, description, color, contextIds, parentProjectId } = result.data;

  const project = await withTransaction(
    async (tx) => {
      for (const ctxId of contextIds) {
        await assertOwnership(tx, "contexts", ctxId, session.userId);
      }
      if (parentProjectId) {
        await assertOwnership(tx, "projects", parentProjectId, session.userId);
      }

      const [created] = await tx<Omit<Project, "context_ids">[]>`
      INSERT INTO projects (user_id, name, description, color, parent_project_id, sort_order)
      VALUES (${session.userId}, ${name}, ${description || null}, ${
        color || null
      }, ${parentProjectId || null}, (
        SELECT COALESCE(MAX(sort_order), 0) + 1 FROM projects WHERE user_id = ${session.userId} AND parent_project_id IS NOT DISTINCT FROM ${
        parentProjectId || null
      }
      ))
      RETURNING *
    `;

      if (contextIds.length > 0) {
        await tx`
          INSERT INTO project_contexts (project_id, context_id)
          SELECT ${created.id}, unnest(${contextIds}::uuid[])
        `;
      }

      return { ...created, context_ids: contextIds };
    },
    { userId: session.userId },
  );

  return c.json(project, 201);
});

// GET /api/projects - List projects
projects.get("/", async (c) => {
  const session = c.get("session") as SessionData;

  const projectList = await withDb(
    async (sql: SqlQuery) => {
      const result = await sql<ProjectWithCount[]>`
      SELECT p.*,
        COUNT(DISTINCT t.id)::int as task_count,
        COALESCE(array_agg(DISTINCT pc.context_id) FILTER (WHERE pc.context_id IS NOT NULL), '{}') as context_ids
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL AND t.completed_at IS NULL
      LEFT JOIN project_contexts pc ON p.id = pc.project_id
      GROUP BY p.id
      ORDER BY p.sort_order, p.created_at
    `;
      return result;
    },
    { userId: session.userId },
  );

  return c.json(projectList);
});

// GET /api/projects/inbox - Get inbox (tasks with no project)
projects.get("/inbox", async (c) => {
  const session = c.get("session") as SessionData;

  const tasks = await withDb(
    async (sql: SqlQuery) => {
      const result = await sql`
      SELECT * FROM tasks
      WHERE project_id IS NULL AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
      return result;
    },
    { userId: session.userId },
  );

  return c.json({
    id: null,
    name: "Inbox",
    description: "Tasks without a project",
    tasks,
  });
});

// GET /api/projects/:id - Get single project
projects.get("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const project = await withDb(
    async (sql: SqlQuery) => {
      const [result] = await sql<ProjectWithCount[]>`
      SELECT p.*,
        COUNT(DISTINCT t.id)::int as task_count,
        COALESCE(array_agg(DISTINCT pc.context_id) FILTER (WHERE pc.context_id IS NOT NULL), '{}') as context_ids
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL AND t.completed_at IS NULL
      LEFT JOIN project_contexts pc ON p.id = pc.project_id
      WHERE p.id = ${id}
      GROUP BY p.id
    `;
      return result || null;
    },
    { userId: session.userId },
  );

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(project);
});

// PATCH /api/projects/:id - Update project
projects.patch("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");
  const body = await c.req.json();
  const result = updateProjectSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const updates = result.data;

  // Prevent circular parent references
  if (
    updates.parentProjectId !== undefined &&
    updates.parentProjectId !== null
  ) {
    if (updates.parentProjectId === id) {
      return c.json({ error: "A project cannot be its own parent" }, 400);
    }

    // Check if the proposed parent is a descendant of this project
    const isDescendant = await withDb(
      async (sql: SqlQuery) => {
        // Walk down from 'id' to find all descendants
        const allProjects = await sql<
          Project[]
        >`SELECT id, parent_project_id FROM projects`;
        const childrenMap = new Map<string, string[]>();
        for (const p of allProjects) {
          const parentId = p.parent_project_id ?? "";
          if (!childrenMap.has(parentId)) childrenMap.set(parentId, []);
          childrenMap.get(parentId)!.push(p.id);
        }

        const visited = new Set<string>();
        const stack = [id];
        while (stack.length > 0) {
          const current = stack.pop()!;
          const children = childrenMap.get(current);
          if (!children) continue;
          for (const childId of children) {
            if (childId === updates.parentProjectId) return true;
            if (!visited.has(childId)) {
              visited.add(childId);
              stack.push(childId);
            }
          }
        }
        return false;
      },
      { userId: session.userId },
    );

    if (isDescendant) {
      return c.json(
        { error: "Cannot set parent to a descendant project" },
        400,
      );
    }
  }

  const project = await withTransaction(
    async (tx) => {
      if (updates.contextIds) {
        for (const ctxId of updates.contextIds) {
          await assertOwnership(tx, "contexts", ctxId, session.userId);
        }
      }
      if (updates.parentProjectId) {
        await assertOwnership(
          tx,
          "projects",
          updates.parentProjectId,
          session.userId,
        );
      }

      const [existing] = await tx<
        Omit<Project, "context_ids">[]
      >`SELECT * FROM projects WHERE id = ${id}`;
      if (!existing) return null;

      const [updated] = await tx<Omit<Project, "context_ids">[]>`
      UPDATE projects SET
        name = COALESCE(${updates.name ?? null}, name),
        description = ${
        updates.description !== undefined
          ? updates.description
          : existing.description
      },
        color = ${updates.color !== undefined ? updates.color : existing.color},
        parent_project_id = ${
        updates.parentProjectId !== undefined
          ? updates.parentProjectId
          : existing.parent_project_id
      },
        sort_order = ${
        updates.sortOrder !== undefined
          ? updates.sortOrder
          : existing.sort_order
      }
      WHERE id = ${id}
      RETURNING *
    `;

      // Update context associations if provided
      let contextIds: string[];
      if (updates.contextIds !== undefined) {
        await tx`DELETE FROM project_contexts WHERE project_id = ${id}`;
        if (updates.contextIds.length > 0) {
          await tx`
            INSERT INTO project_contexts (project_id, context_id)
            SELECT ${id}, unnest(${updates.contextIds}::uuid[])
          `;
        }
        contextIds = updates.contextIds;
      } else {
        const rows = await tx<{ context_id: string }[]>`
          SELECT context_id FROM project_contexts WHERE project_id = ${id}
        `;
        contextIds = rows.map((r) => r.context_id);
      }

      return { ...updated, context_ids: contextIds };
    },
    { userId: session.userId },
  );

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(project);
});

// DELETE /api/projects/:id - Delete project (moves tasks to Inbox)
projects.delete("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const deleted = await withTransaction(
    async (tx) => {
      const [existing] = await tx<
        Project[]
      >`SELECT * FROM projects WHERE id = ${id}`;
      if (!existing) return null;

      // Move tasks to Inbox (set project_id to NULL)
      await tx`UPDATE tasks SET project_id = NULL WHERE project_id = ${id}`;

      // Re-parent child projects to Inbox (clear parent)
      await tx`UPDATE projects SET parent_project_id = NULL WHERE parent_project_id = ${id}`;

      // Delete project
      await tx`DELETE FROM projects WHERE id = ${id}`;

      return existing;
    },
    { userId: session.userId },
  );

  if (!deleted) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({
    message: "Project deleted, tasks moved to Inbox",
    project: deleted,
  });
});
