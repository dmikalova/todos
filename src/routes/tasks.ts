// Task management API routes

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb, withTransaction } from "../db/index.ts";
import { logTaskActionTx } from "../services/history.ts";
import { assertOwnership } from "../services/ownership.ts";
import {
  calculateNextOccurrence,
  type RecurrenceRule,
} from "../services/recurrence.ts";
import type { AppEnv, SessionData } from "../types.ts";

export const tasks = new Hono<AppEnv>();

// Zod schemas for validation

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(1).max(4).default(2),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  mustDo: z.boolean().default(false),
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
});

const listTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
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
  user_id: string;
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

// POST /api/tasks - Create task
tasks.post("/", async (c) => {
  const session = c.get("session") as SessionData;
  const body = await c.req.json();
  const result = createTaskSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { title, description, projectId, priority, dueDate, mustDo } =
    result.data;

  const task = await withTransaction(
    async (tx) => {
      // Validate project ownership if provided
      if (projectId) {
        await assertOwnership(tx, "projects", projectId, session.userId);
      }

      const [created] = await tx<Task[]>`
      INSERT INTO tasks (user_id, title, description, project_id, priority, due_date, must_do)
      VALUES (${session.userId}, ${title}, ${description || null}, ${
        projectId || null
      }, ${priority}, ${dueDate || null}, ${mustDo})
      RETURNING *
    `;

      // Log creation
      await logTaskActionTx(tx, {
        taskId: created.id,
        userId: session.userId,
        action: "created",
        details: { title, projectId, priority, dueDate, mustDo },
      });

      return created;
    },
    { userId: session.userId },
  );

  return c.json(task, 201);
});

// GET /api/tasks - List tasks
tasks.get("/", async (c) => {
  const session = c.get("session") as SessionData;
  const query = Object.fromEntries(new URL(c.req.url).searchParams);
  const result = listTasksSchema.safeParse(query);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { projectId, completed, deleted, dueBefore, dueAfter, limit, offset } =
    result.data;

  const taskList = await withDb(
    async (sql: SqlQuery) => {
      const tasks = await sql<Task[]>`
      SELECT t.*,
        r.frequency as recurrence_type,
        r.interval as recurrence_interval,
        r.days_of_week as recurrence_days
      FROM tasks t
      LEFT JOIN recurrence_rules r ON r.task_id = t.id
      WHERE 1=1
      ${projectId ? sql`AND t.project_id = ${projectId}` : sql``}
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

      return tasks;
    },
    { userId: session.userId },
  );

  return c.json(taskList);
});

// GET /api/tasks/:id - Get single task
tasks.get("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const task = await withDb(
    async (sql: SqlQuery) => {
      const [result] = await sql<Task[]>`
      SELECT t.*,
        r.frequency as recurrence_type,
        r.interval as recurrence_interval,
        r.days_of_week as recurrence_days
      FROM tasks t
      LEFT JOIN recurrence_rules r ON r.task_id = t.id
      WHERE t.id = ${id}
    `;
      return result || null;
    },
    { userId: session.userId },
  );

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(task);
});

// PATCH /api/tasks/:id - Update task
tasks.patch("/:id", async (c) => {
  const session = c.get("session") as SessionData;
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

  const task = await withTransaction(
    async (tx) => {
      // Validate project ownership if updating projectId
      if (updates.projectId) {
        await assertOwnership(
          tx,
          "projects",
          updates.projectId,
          session.userId,
        );
      }

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
        updates.projectId !== undefined
          ? updates.projectId
          : existing.project_id
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

      // Log update
      await logTaskActionTx(tx, {
        taskId: id,
        userId: session.userId,
        action: "updated",
        details: { changes: updates },
      });

      return updated;
    },
    { userId: session.userId },
  );

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(task);
});

// DELETE /api/tasks/:id - Soft delete task
tasks.delete("/:id", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const task = await withTransaction(
    async (tx) => {
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
        userId: session.userId,
        action: "deleted",
        details: { title: existing.title },
      });

      return deleted;
    },
    { userId: session.userId },
  );

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json({ message: "Task deleted", task });
});

// POST /api/tasks/:id/complete - Complete task
tasks.post("/:id/complete", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const result = await withTransaction(
    async (tx) => {
      const [existing] = await tx<Task[]>`SELECT * FROM tasks WHERE id = ${id}`;
      if (!existing) {
        return null;
      }

      if (existing.completed_at) {
        return { error: "Task already completed", task: existing };
      }

      // Check for recurrence rule
      const [rule] = await tx<RecurrenceRule[]>`
      SELECT * FROM recurrence_rules WHERE task_id = ${id}
    `;

      const completionDate = new Date();

      const [completed] = await tx<Task[]>`
      UPDATE tasks SET completed_at = ${completionDate}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

      await logTaskActionTx(tx, {
        taskId: id,
        userId: session.userId,
        action: "completed",
        details: { title: existing.title, recurring: !!rule },
      });

      let newTask: Task | null = null;

      // If task has recurrence, create next instance
      if (rule) {
        const nextDueDate = calculateNextOccurrence(rule, completionDate);

        // Create next task instance
        [newTask] = await tx<Task[]>`
        INSERT INTO tasks (user_id, title, description, project_id, priority, due_date, must_do)
        VALUES (
          ${session.userId},
          ${existing.title},
          ${existing.description},
          ${existing.project_id},
          ${existing.priority},
          ${nextDueDate.toISOString().split("T")[0]},
          ${existing.must_do}
        )
        RETURNING *
      `;

        // Copy recurrence rule to new task
        await tx`
        INSERT INTO recurrence_rules (
          task_id, schedule_type, frequency, interval,
          days_of_week, day_of_month, month_of_year, days_after_completion
        )
        VALUES (
          ${newTask.id},
          ${rule.schedule_type},
          ${rule.frequency},
          ${rule.interval},
          ${rule.days_of_week},
          ${rule.day_of_month},
          ${rule.month_of_year},
          ${rule.days_after_completion}
        )
      `;

        await logTaskActionTx(tx, {
          taskId: newTask.id,
          userId: session.userId,
          action: "created",
          details: {
            title: newTask.title,
            fromRecurrence: true,
            previousTaskId: id,
          },
        });
      }

      return { task: completed, newTask };
    },
    { userId: session.userId },
  );

  if (!result) {
    return c.json({ error: "Task not found" }, 404);
  }

  if ("error" in result) {
    return c.json({ error: result.error }, 400);
  }

  return c.json(result.task);
});

// DELETE /api/tasks/:id/complete - Undo complete
tasks.delete("/:id/complete", async (c) => {
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const task = await withTransaction(
    async (tx) => {
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
        userId: session.userId,
        action: "uncompleted",
        details: { title: existing.title },
      });

      return { task: uncompleted };
    },
    { userId: session.userId },
  );

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
  const session = c.get("session") as SessionData;
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

  const task = await withTransaction(
    async (tx) => {
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
        userId: session.userId,
        action: "deferred",
        details: {
          until: deferUntil.toISOString(),
          preset: result.data.preset,
        },
      });

      return { task: deferred };
    },
    { userId: session.userId },
  );

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
  const session = c.get("session") as SessionData;
  const id = c.req.param("id");

  const task = await withTransaction(
    async (tx) => {
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
        userId: session.userId,
        action: "undeferred",
        details: { title: existing.title },
      });

      return undeferred;
    },
    { userId: session.userId },
  );

  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(task);
});
