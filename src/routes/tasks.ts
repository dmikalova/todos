// Task management API routes

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb, withTransaction } from "../db/index.ts";
import { calculateDeferDate } from "../services/defer.ts";
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
  projectId: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(1).max(3).default(3),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  contextIds: z.array(z.string().uuid()).optional().default([]),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  projectId: z.string().uuid().optional().nullable(),
  priority: z.number().int().min(1).max(3).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  contextIds: z.array(z.string().uuid()).optional(),
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
  project_id: string | null;
  priority: number;
  due_date: string | null;
  deferred_until: Date | null;
  completed_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
  context_ids: string[];
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

  const { title, projectId, priority, dueDate, contextIds } = result.data;

  const task = await withTransaction(
    async (tx) => {
      // Validate project ownership if provided
      if (projectId) {
        await assertOwnership(tx, "projects", projectId, session.userId);
      }
      // Validate context ownership
      for (const ctxId of contextIds) {
        await assertOwnership(tx, "contexts", ctxId, session.userId);
      }

      const [created] = await tx<Omit<Task, "context_ids">[]>`
      INSERT INTO tasks (user_id, title, project_id, priority, due_date)
      VALUES (${session.userId}, ${title}, ${projectId || null}, ${priority}, ${
        dueDate || null
      })
      RETURNING *
    `;

      if (contextIds.length > 0) {
        await tx`
          INSERT INTO task_contexts (task_id, context_id)
          SELECT ${created.id}, unnest(${contextIds}::uuid[])
        `;
      }

      // Log creation
      await logTaskActionTx(tx, {
        taskId: created.id,
        userId: session.userId,
        action: "created",
        details: { title, projectId, priority, dueDate, contextIds },
      });

      return { ...created, context_ids: contextIds };
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
        r.days_of_week as recurrence_days,
        COALESCE(array_agg(tc.context_id) FILTER (WHERE tc.context_id IS NOT NULL), '{}') as context_ids
      FROM tasks t
      LEFT JOIN recurrence_rules r ON r.task_id = t.id
      LEFT JOIN task_contexts tc ON t.id = tc.task_id
      WHERE 1=1
      ${projectId ? sql`AND t.project_id = ${projectId}` : sql``}
      ${completed === "true" ? sql`AND t.completed_at IS NOT NULL` : sql``}
      ${completed === "false" ? sql`AND t.completed_at IS NULL` : sql``}
      ${deleted === "true" ? sql`AND t.deleted_at IS NOT NULL` : sql``}
      ${deleted !== "true" ? sql`AND t.deleted_at IS NULL` : sql``}
      ${dueBefore ? sql`AND t.due_date <= ${dueBefore}` : sql``}
      ${dueAfter ? sql`AND t.due_date >= ${dueAfter}` : sql``}
      GROUP BY t.id, r.frequency, r.interval, r.days_of_week
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
        r.days_of_week as recurrence_days,
        COALESCE(array_agg(tc.context_id) FILTER (WHERE tc.context_id IS NOT NULL), '{}') as context_ids
      FROM tasks t
      LEFT JOIN recurrence_rules r ON r.task_id = t.id
      LEFT JOIN task_contexts tc ON t.id = tc.task_id
      WHERE t.id = ${id}
      GROUP BY t.id, r.frequency, r.interval, r.days_of_week
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
      // Validate context ownership
      if (updates.contextIds) {
        for (const ctxId of updates.contextIds) {
          await assertOwnership(tx, "contexts", ctxId, session.userId);
        }
      }

      // Get current task for history
      const [existing] = await tx<
        Omit<Task, "context_ids">[]
      >`SELECT * FROM tasks WHERE id = ${id}`;
      if (!existing) {
        return null;
      }

      // Build update
      const [updated] = await tx<Omit<Task, "context_ids">[]>`
      UPDATE tasks SET
        title = COALESCE(${updates.title ?? null}, title),
        project_id = ${
        updates.projectId !== undefined
          ? updates.projectId
          : existing.project_id
      },
        priority = COALESCE(${updates.priority ?? null}, priority),
        due_date = ${
        updates.dueDate !== undefined ? updates.dueDate : existing.due_date
      },
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

      // Update context associations if provided
      let contextIds: string[];
      if (updates.contextIds !== undefined) {
        await tx`DELETE FROM task_contexts WHERE task_id = ${id}`;
        if (updates.contextIds.length > 0) {
          await tx`
            INSERT INTO task_contexts (task_id, context_id)
            SELECT ${id}, unnest(${updates.contextIds}::uuid[])
          `;
        }
        contextIds = updates.contextIds;
      } else {
        const rows = await tx<{ context_id: string }[]>`
          SELECT context_id FROM task_contexts WHERE task_id = ${id}
        `;
        contextIds = rows.map((r) => r.context_id);
      }

      // Log update
      await logTaskActionTx(tx, {
        taskId: id,
        userId: session.userId,
        action: "updated",
        details: { changes: updates },
      });

      return { ...updated, context_ids: contextIds };
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

      // Clear next selection so a new task is picked
      await tx`
        UPDATE user_next_selection SET task_id = NULL
        WHERE user_id = ${session.userId} AND task_id = ${id}
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
        INSERT INTO tasks (user_id, title, project_id, priority, due_date)
        VALUES (
          ${session.userId},
          ${existing.title},
          ${existing.project_id},
          ${existing.priority},
          ${nextDueDate}
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
    deferUntil = calculateDeferDate(result.data.preset, now);
  } else {
    return c.json({ error: "Either 'until' or 'preset' is required" }, 400);
  }

  const task = await withTransaction(
    async (tx) => {
      const [existing] = await tx<
        Omit<Task, "context_ids">[]
      >`SELECT * FROM tasks WHERE id = ${id}`;
      if (!existing) {
        return null;
      }

      const [deferred] = await tx<Omit<Task, "context_ids">[]>`
      UPDATE tasks SET deferred_until = ${deferUntil}, updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

      // Clear next selection so a new task is picked
      await tx`
        UPDATE user_next_selection SET task_id = NULL
        WHERE user_id = ${session.userId} AND task_id = ${id}
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
