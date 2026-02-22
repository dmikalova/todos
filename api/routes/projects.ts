// Projects API routes

import { Hono } from "hono";
import { z } from "zod";
import { withDb, withTransaction } from "../db/index.ts";
import type { AppEnv } from "../types.ts";
import { type SqlQuery } from "../db/index.ts";

export const projects = new Hono<AppEnv>();

// Zod schemas

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
});

// Types

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
}

interface ProjectWithCount extends Project {
  task_count: number;
}

// POST /api/projects - Create project
projects.post("/", async (c) => {
  const body = await c.req.json();
  const result = createProjectSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { name, description } = result.data;

  const project = await withDb(async (sql: SqlQuery) => {
    const [created] = await sql<Project[]>`
      INSERT INTO projects (name, description)
      VALUES (${name}, ${description || null})
      RETURNING *
    `;
    return created;
  });

  return c.json(project, 201);
});

// GET /api/projects - List projects
projects.get("/", async (c) => {
  const projectList = await withDb(async (sql: SqlQuery) => {
    const result = await sql<ProjectWithCount[]>`
      SELECT p.*, COUNT(t.id)::int as task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL
      GROUP BY p.id
      ORDER BY p.name
    `;
    return result;
  });

  return c.json(projectList);
});

// GET /api/projects/inbox - Get inbox (tasks with no project)
projects.get("/inbox", async (c) => {
  const tasks = await withDb(async (sql: SqlQuery) => {
    const result = await sql`
      SELECT * FROM tasks
      WHERE project_id IS NULL AND deleted_at IS NULL
      ORDER BY created_at DESC
    `;
    return result;
  });

  return c.json({
    id: null,
    name: "Inbox",
    description: "Tasks without a project",
    tasks,
  });
});

// GET /api/projects/:id - Get single project
projects.get("/:id", async (c) => {
  const id = c.req.param("id");

  const project = await withDb(async (sql: SqlQuery) => {
    const [result] = await sql<ProjectWithCount[]>`
      SELECT p.*, COUNT(t.id)::int as task_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id AND t.deleted_at IS NULL
      WHERE p.id = ${id}
      GROUP BY p.id
    `;
    return result || null;
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(project);
});

// PATCH /api/projects/:id - Update project
projects.patch("/:id", async (c) => {
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

  const project = await withDb(async (sql: SqlQuery) => {
    const [existing] = await sql<
      Project[]
    >`SELECT * FROM projects WHERE id = ${id}`;
    if (!existing) return null;

    const [updated] = await sql<Project[]>`
      UPDATE projects SET
        name = COALESCE(${updates.name ?? null}, name),
        description = ${
      updates.description !== undefined
        ? updates.description
        : existing.description
    }
      WHERE id = ${id}
      RETURNING *
    `;
    return updated;
  });

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(project);
});

// DELETE /api/projects/:id - Delete project (moves tasks to Inbox)
projects.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const deleted = await withTransaction(async (tx) => {
    const [existing] = await tx<
      Project[]
    >`SELECT * FROM projects WHERE id = ${id}`;
    if (!existing) return null;

    // Move tasks to Inbox (set project_id to NULL)
    await tx`UPDATE tasks SET project_id = NULL WHERE project_id = ${id}`;

    // Delete project
    await tx`DELETE FROM projects WHERE id = ${id}`;

    return existing;
  });

  if (!deleted) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({
    message: "Project deleted, tasks moved to Inbox",
    project: deleted,
  });
});
