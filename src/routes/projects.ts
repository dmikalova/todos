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
  contextId: z.string().uuid().optional().nullable(),
  parentProjectId: z.string().uuid().optional().nullable(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  color: z.string().optional().nullable(),
  contextId: z.string().uuid().optional().nullable(),
  parentProjectId: z.string().uuid().optional().nullable(),
});

// Types

interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string | null;
  context_id: string | null;
  parent_project_id: string | null;
  created_at: Date;
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

  const { name, description, color, contextId, parentProjectId } = result.data;

  const project = await withTransaction(async (tx) => {
    if (contextId) {
      await assertOwnership(tx, "contexts", contextId, session.userId);
    }
    if (parentProjectId) {
      await assertOwnership(tx, "projects", parentProjectId, session.userId);
    }

    const [created] = await tx<Project[]>`
      INSERT INTO projects (user_id, name, description, color, context_id, parent_project_id)
      VALUES (${session.userId}, ${name}, ${description || null}, ${
      color || null
    }, ${contextId || null}, ${parentProjectId || null})
      RETURNING *
    `;
    return created;
  }, { userId: session.userId });

  return c.json(project, 201);
});

// GET /api/projects - List projects
projects.get("/", async (c) => {
  const session = c.get("session") as SessionData;

  const projectList = await withDb(async (sql: SqlQuery) => {
    const result = await sql<ProjectWithCount[]>`
      SELECT p.*, COUNT(t.id)::int as task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL AND t.completed_at IS NULL
      GROUP BY p.id
      ORDER BY p.name
    `;
    return result;
  }, { userId: session.userId });

  return c.json(projectList);
});

// GET /api/projects/inbox - Get inbox (tasks with no project)
projects.get("/inbox", async (c) => {
  const session = c.get("session") as SessionData;

  const tasks = await withDb(async (sql: SqlQuery) => {
    const result = await sql`
      SELECT * FROM tasks
      WHERE project_id IS NULL AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    return result;
  }, { userId: session.userId });

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

  const project = await withDb(async (sql: SqlQuery) => {
    const [result] = await sql<ProjectWithCount[]>`
      SELECT p.*, COUNT(t.id)::int as task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL AND t.completed_at IS NULL
      WHERE p.id = ${id}
      GROUP BY p.id
    `;
    return result || null;
  }, { userId: session.userId });

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

  const project = await withTransaction(async (tx) => {
    if (updates.contextId) {
      await assertOwnership(tx, "contexts", updates.contextId, session.userId);
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
      Project[]
    >`SELECT * FROM projects WHERE id = ${id}`;
    if (!existing) return null;

    const [updated] = await tx<Project[]>`
      UPDATE projects SET
        name = COALESCE(${updates.name ?? null}, name),
        description = ${
      updates.description !== undefined
        ? updates.description
        : existing.description
    },
        color = ${updates.color !== undefined ? updates.color : existing.color},
        context_id = ${
      updates.contextId !== undefined ? updates.contextId : existing.context_id
    },
        parent_project_id = ${
      updates.parentProjectId !== undefined
        ? updates.parentProjectId
        : existing.parent_project_id
    }
      WHERE id = ${id}
      RETURNING *
    `;
    return updated;
  }, { userId: session.userId });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(project);
});

// DELETE /api/projects/:id - Delete project (moves tasks to Inbox)
projects.delete("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const deleted = await withTransaction(async (tx) => {
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
  }, { userId: session.userId });

  if (!deleted) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({
    message: "Project deleted, tasks moved to Inbox",
    project: deleted,
  });
});
