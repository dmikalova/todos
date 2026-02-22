// Task management API routes

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb, withTransaction } from "../db/index.ts";
import { logTaskActionTx } from "../services/history.ts";
import type { AppEnv } from "../types.ts";

export const tasks = new Hono<AppEnv>();

// Zod schemas for validation

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  projectId: z.string().uuid().optional(),
  priority: z.number().int().min(1).max(4).default(2),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  mustDo: z.boolean().default(false),
  contextIds: z.array(z.string().uuid()).default([]),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(1).max(4).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  mustDo: z.boolean().optional(),
  contextIds: z.array(z.string().uuid()).optional(),
});

const listTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  contextId: z.string().uuid().optional(),
  completed: z.enum(["true", "false"]).optional(),
  deleted: z.enum(["true", "false"]).optional(),
  dueBefore: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dueAfter: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Types

interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  priority: number;
  due_date: string | null;
  must_do: boolean;
  deferred_until: Date | null;
  completed_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface TaskWithContexts extends Task {
  context_ids: string[];
}

// Helper to fetch task with contexts
async function getTaskWithContexts(
  sql: SqlQuery,
  taskId: string,
): Promise<TaskWithContexts | null> {
  const [task] = await sql<Task[]>`
    SELECT * FROM tasks WHERE id = ${taskId}
  `;

  if (!task) return null;

  const contexts = await sql<{ context_id: string }[]>`
    SELECT context_id FROM task_contexts WHERE task_id = ${taskId}
  `;

  return {
    ...task,
    context_ids: contexts.map((c) => c.context_id),
  };
}

// Helper to sync task contexts
async function syncTaskContexts(
  tx: SqlQuery,
  taskId: string,
  contextIds: string[],
): Promise<void> {
  // Delete existing contexts
  await tx`DELETE FROM task_contexts WHERE task_id = ${taskId}`;

  // Insert new contexts
  if (contextIds.length > 0) {
    for (const contextId of contextIds) {
      await tx`
        INSERT INTO task_contexts (task_id, context_id)
        VALUES (${taskId}, ${contextId})
      `;
    }
  }
}

// POST /api/tasks - Create task
tasks.post("/", async (c) => {
  const body = await c.req.json();
  const result = createTaskSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const {
    title,
    description,
    projectId,
    priority,
    dueDate,
    mustDo,
    contextIds,
  } = result.data;

  const task = await withTransaction(async (tx) => {
    const [created] = await tx<Task[]>`
      INSERT INTO tasks (title, description, project_id, priority, due_date, must_do)
      VALUES (${title}, ${description || null}, ${
      projectId || null
    }, ${priority}, ${dueDate || null}, ${mustDo})
      RETURNING *
    `;

    // Add contexts
    if (contextIds.length > 0) {
      await syncTaskContexts(tx, created.id, contextIds);
    }

    // Log creation
    await logTaskActionTx(tx, {
      taskId: created.id,
      action: "created",
      details: { title, projectId, priority, dueDate, mustDo, contextIds },
    });

    return { ...created, context_ids: contextIds };
  });

  return c.json(task, 201);
});

// GET /api/tasks - List tasks
tasks.get("/", async (c) => {
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const result = listTasksSchema.safeParse(query);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const {
    projectId,
    contextId,
    completed,
    deleted,
    dueBefore,
    dueAfter,
    limit,
    offset,
  } = result.data;

  const taskList = await withDb(async (sql: SqlQuery) => {
    // Execute with conditional fragments
    const tasks = await sql<Task[]>`
      SELECT DISTINCT t.*
      FROM tasks t
      LEFT JOIN task_contexts tc ON t.id = tc.task_id
      WHERE 1=1
      ${projectId ? sql`AND t.project_id = ${projectId}` : sql``}
      ${contextId ? sql`AND tc.context_id = ${contextId}` : sql``}
      ${completed === "true" ? sql`AND t.completed_at IS NOT NULL` : sql``}
      ${completed === "false" ? sql`AND t.completed_at IS NULL` : sql``}
      ${deleted === "true" ? sql`AND t.deleted_at IS NOT NULL` : sql``}
      ${deleted === "false" ? sql`AND t.deleted_at IS NULL` : sql``}
      ${dueBefore ? sql`AND t.due_date <= ${dueBefore}` : sql``}
      ${dueAfter ? sql`AND t.due_date >= ${dueAfter}` : sql``}
      ORDER BY t.created_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `;

    // Fetch contexts for each task
    const tasksWithContexts: TaskWithContexts[] = [];
    for (const task of tasks) {
      const contexts = await sql<{ context_id: string }[]>`
        SELECT context_id FROM task_contexts WHERE task_id = ${task.id}
      `;
      tasksWithContexts.push({
        ...task,
        context_ids: contexts.map((c) => c.context_id),
      });
    }

    return tasksWithContexts;
  });

  return c.json(taskList);
});

// GET /api/tasks/:id - Get single task
tasks.get("/:id", async (c) => {
  const id = c.req.param("id");

  const task = await withDb((sql: SqlQuery) => {
    return getTaskWithContexts(sql, id);
  });

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(task);
});

// PATCH /api/tasks/:id - Update task
tasks.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const result = updateTaskSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const updates = result.data;

  const task = await withTransaction(async (tx) => {
    // Get current task for history
    const [existing] = await tx<Task[]>`SELECT * FROM tasks WHERE id = ${id}`;
    if (!existing) {
      return null;
    }

    // Build update
    const [updated] = await tx<Task[]>`
      UPDATE tasks SET
        title = COALESCE(${updates.title ?? null}, title),
        description = ${
      updates.description !== undefined
        ? updates.description
        : existing.description
    },
        project_id = ${
      updates.projectId !== undefined ? updates.projectId : existing.project_id
    },
        priority = COALESCE(${updates.priority ?? null}, priority),
        due_date = ${
      updates.dueDate !== undefined ? updates.dueDate : existing.due_date
    },
        must_do = COALESCE(${updates.mustDo ?? null}, must_do),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    // Update contexts if provided
    let contextIds: string[] = [];
    if (updates.contextIds !== undefined) {
      await syncTaskContexts(tx, id, updates.contextIds);
      contextIds = updates.contextIds;
    } else {
      const contexts: { context_id: string }[] = await tx`
        SELECT context_id FROM task_contexts WHERE task_id = ${id}
      `;
      contextIds = contexts.map((c: { context_id: string }) => c.context_id);
    }

    // Log update
    await logTaskActionTx(tx, {
      taskId: id,
      action: "updated",
      details: { changes: updates },
    });

    return { ...updated, context_ids: contextIds };
  });

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(task);
});

// DELETE /api/tasks/:id - Soft delete task
tasks.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const task = await withTransaction(async (tx) => {
    const [existing] = await tx<Task[]>`SELECT * FROM tasks WHERE id = ${id}`;
    if (!existing) {
      return null;
    }

    const [deleted] = await tx<Task[]>`
      UPDATE tasks SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    await logTaskActionTx(tx, {
      taskId: id,
      action: "deleted",
      details: { title: existing.title },
    });

    return deleted;
  });

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ message: "Task deleted", task });
});

// POST /api/tasks/:id/complete - Complete task
tasks.post("/:id/complete", async (c) => {
  const id = c.req.param("id");

  const task = await withTransaction(async (tx) => {
    const [existing] = await tx<Task[]>`SELECT * FROM tasks WHERE id = ${id}`;
    if (!existing) {
      return null;
    }

    if (existing.completed_at) {
      return { error: "Task already completed", task: existing };
    }

    const [completed] = await tx<Task[]>`
      UPDATE tasks SET completed_at = NOW(), updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    await logTaskActionTx(tx, {
      taskId: id,
      action: "completed",
      details: { title: existing.title },
    });

    return { task: completed };
  });

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  if ("error" in task) {
    return c.json({ error: task.error }, 400);
  }

  return c.json(task.task);
});

// DELETE /api/tasks/:id/complete - Undo complete
tasks.delete("/:id/complete", async (c) => {
  const id = c.req.param("id");

  const task = await withTransaction(async (tx) => {
    const [existing] = await tx<Task[]>`SELECT * FROM tasks WHERE id = ${id}`;
    if (!existing) {
      return null;
    }

    if (!existing.completed_at) {
      return { error: "Task is not completed", task: existing };
    }

    const [uncompleted] = await tx<Task[]>`
      UPDATE tasks SET completed_at = NULL, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    await logTaskActionTx(tx, {
      taskId: id,
      action: "uncompleted",
      details: { title: existing.title },
    });

    return { task: uncompleted };
  });

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  if ("error" in task) {
    return c.json({ error: task.error }, 400);
  }

  return c.json(task.task);
});

// POST /api/tasks/:id/defer - Defer task
tasks.post("/:id/defer", async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();

  const deferSchema = z.object({
    until: z.string().datetime().optional(),
    preset: z
      .enum(["later_today", "tomorrow", "weekend", "next_week"])
      .optional(),
  });

  const result = deferSchema.safeParse(body);
  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  let deferUntil: Date;
  const now = new Date();

  if (result.data.until) {
    deferUntil = new Date(result.data.until);
  } else if (result.data.preset) {
    switch (result.data.preset) {
      case "later_today":
        deferUntil = new Date(now.getTime() + 4 * 60 * 60 * 1000);
        break;
      case "tomorrow":
        deferUntil = new Date(now);
        deferUntil.setDate(deferUntil.getDate() + 1);
        deferUntil.setHours(9, 0, 0, 0);
        break;
      case "weekend": {
        deferUntil = new Date(now);
        const dayOfWeek = deferUntil.getDay();
        const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
        deferUntil.setDate(deferUntil.getDate() + daysUntilSaturday);
        deferUntil.setHours(10, 0, 0, 0);
        break;
      }
      case "next_week": {
        deferUntil = new Date(now);
        const currentDay = deferUntil.getDay();
        const daysUntilMonday = (8 - currentDay) % 7 || 7;
        deferUntil.setDate(deferUntil.getDate() + daysUntilMonday);
        deferUntil.setHours(9, 0, 0, 0);
        break;
      }
    }
  } else {
    return c.json({ error: "Either 'until' or 'preset' is required" }, 400);
  }

  const task = await withTransaction(async (tx) => {
    const [existing] = await tx<Task[]>`SELECT * FROM tasks WHERE id = ${id}`;
    if (!existing) {
      return null;
    }

    if (existing.must_do) {
      return { error: "Cannot defer must-do tasks" };
    }

    const [deferred] = await tx<Task[]>`
      UPDATE tasks SET deferred_until = ${deferUntil}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    await logTaskActionTx(tx, {
      taskId: id,
      action: "deferred",
      details: { until: deferUntil.toISOString(), preset: result.data.preset },
    });

    return { task: deferred };
  });

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  if ("error" in task) {
    return c.json({ error: task.error }, 400);
  }

  return c.json(task.task);
});

// DELETE /api/tasks/:id/defer - Clear defer
tasks.delete("/:id/defer", async (c) => {
  const id = c.req.param("id");

  const task = await withTransaction(async (tx) => {
    const [existing] = await tx<Task[]>`SELECT * FROM tasks WHERE id = ${id}`;
    if (!existing) {
      return null;
    }

    const [undeferred] = await tx<Task[]>`
      UPDATE tasks SET deferred_until = NULL, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    await logTaskActionTx(tx, {
      taskId: id,
      action: "undeferred",
      details: { title: existing.title },
    });

    return undeferred;
  });

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(task);
});
