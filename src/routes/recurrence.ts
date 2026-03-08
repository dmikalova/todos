// Recurrence API routes

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb, withTransaction } from "../db/index.ts";
import { logTaskActionTx } from "../services/history.ts";
import {
  calculateNextOccurrence,
  type RecurrenceRule,
  validateRecurrenceRule,
} from "../services/recurrence.ts";
import type { AppEnv } from "../types.ts";

export const recurrence = new Hono<AppEnv>();

// Zod schemas

const createRecurrenceSchema = z.object({
  taskId: z.string().uuid(),
  scheduleType: z.enum(["fixed", "completion"]),
  // For fixed schedules
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]).optional(),
  interval: z.number().int().min(1).default(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  dayOfMonth: z.number().int().min(1).max(31).optional(),
  monthOfYear: z.number().int().min(1).max(12).optional(),
  // For completion-based
  daysAfterCompletion: z.number().int().min(1).optional(),
});

const updateRecurrenceSchema = z.object({
  scheduleType: z.enum(["fixed", "completion"]).optional(),
  frequency: z
    .enum(["daily", "weekly", "monthly", "yearly"])
    .optional()
    .nullable(),
  interval: z.number().int().min(1).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
  dayOfMonth: z.number().int().min(1).max(31).optional().nullable(),
  monthOfYear: z.number().int().min(1).max(12).optional().nullable(),
  daysAfterCompletion: z.number().int().min(1).optional().nullable(),
});

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

// POST /api/recurrence - Create recurrence rule for a task
recurrence.post("/", async (c) => {
  const body = await c.req.json();
  const result = createRecurrenceSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const data = result.data;

  // Validate rule logic
  const validation = validateRecurrenceRule({
    schedule_type: data.scheduleType,
    frequency: data.frequency || null,
    interval: data.interval,
    days_of_week: data.daysOfWeek || null,
    day_of_month: data.dayOfMonth || null,
    month_of_year: data.monthOfYear || null,
    days_after_completion: data.daysAfterCompletion || null,
  });

  if (!validation.valid) {
    return c.json(
      { error: "Invalid recurrence rule", details: validation.errors },
      400,
    );
  }

  const rule = await withTransaction(async (tx) => {
    // Check task exists
    const [task] = await tx<
      Task[]
    >`SELECT id FROM tasks WHERE id = ${data.taskId}`;
    if (!task) {
      return { error: "Task not found" };
    }

    // Check no existing rule
    const [existing] = await tx<RecurrenceRule[]>`
      SELECT id FROM recurrence_rules WHERE task_id = ${data.taskId}
    `;
    if (existing) {
      return { error: "Task already has a recurrence rule" };
    }

    // Create rule
    const [created] = await tx<RecurrenceRule[]>`
      INSERT INTO recurrence_rules (
        task_id, schedule_type, frequency, interval,
        days_of_week, day_of_month, month_of_year, days_after_completion
      )
      VALUES (
        ${data.taskId},
        ${data.scheduleType},
        ${data.frequency || null},
        ${data.interval},
        ${data.daysOfWeek || null},
        ${data.dayOfMonth || null},
        ${data.monthOfYear || null},
        ${data.daysAfterCompletion || null}
      )
      RETURNING *
    `;

    return { rule: created };
  });

  if ("error" in rule) {
    const status = rule.error === "Task not found" ? 404 : 400;
    return c.json({ error: rule.error }, status);
  }

  return c.json(rule.rule, 201);
});

// GET /api/recurrence/:taskId - Get recurrence rule for a task
recurrence.get("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(taskId)) {
    return c.json({ error: "Invalid task ID format" }, 400);
  }

  const rule = await withDb(async (sql: SqlQuery) => {
    const [result] = await sql<RecurrenceRule[]>`
      SELECT * FROM recurrence_rules WHERE task_id = ${taskId}
    `;
    return result || null;
  });

  if (!rule) {
    return c.json({ error: "No recurrence rule for this task" }, 404);
  }

  return c.json(rule);
});

// PATCH /api/recurrence/:taskId - Update recurrence rule
recurrence.patch("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  const body = await c.req.json();
  const result = updateRecurrenceSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const updates = result.data;

  const rule = await withTransaction(async (tx) => {
    const [existing] = await tx<RecurrenceRule[]>`
      SELECT * FROM recurrence_rules WHERE task_id = ${taskId}
    `;
    if (!existing) {
      return { error: "No recurrence rule for this task" };
    }

    // Merge with existing for validation
    const merged = {
      schedule_type: updates.scheduleType || existing.schedule_type,
      frequency: updates.frequency !== undefined
        ? updates.frequency
        : existing.frequency,
      interval: updates.interval ?? existing.interval,
      days_of_week: updates.daysOfWeek !== undefined
        ? updates.daysOfWeek
        : existing.days_of_week,
      day_of_month: updates.dayOfMonth !== undefined
        ? updates.dayOfMonth
        : existing.day_of_month,
      month_of_year: updates.monthOfYear !== undefined
        ? updates.monthOfYear
        : existing.month_of_year,
      days_after_completion: updates.daysAfterCompletion !== undefined
        ? updates.daysAfterCompletion
        : existing.days_after_completion,
    };

    const validation = validateRecurrenceRule(merged);
    if (!validation.valid) {
      return { error: "Invalid recurrence rule", details: validation.errors };
    }

    const [updated] = await tx<RecurrenceRule[]>`
      UPDATE recurrence_rules SET
        schedule_type = ${merged.schedule_type},
        frequency = ${merged.frequency},
        interval = ${merged.interval},
        days_of_week = ${merged.days_of_week},
        day_of_month = ${merged.day_of_month},
        month_of_year = ${merged.month_of_year},
        days_after_completion = ${merged.days_after_completion}
      WHERE task_id = ${taskId}
      RETURNING *
    `;

    return { rule: updated };
  });

  if ("error" in rule) {
    const status = rule.error === "No recurrence rule for this task"
      ? 404
      : 400;
    return c.json(rule, status);
  }

  return c.json(rule.rule);
});

// DELETE /api/recurrence/:taskId - Remove recurrence (convert to one-time task)
recurrence.delete("/:taskId", async (c) => {
  const taskId = c.req.param("taskId");

  const deleted = await withDb(async (sql: SqlQuery) => {
    const [existing] = await sql<RecurrenceRule[]>`
      SELECT id FROM recurrence_rules WHERE task_id = ${taskId}
    `;
    if (!existing) {
      return null;
    }

    await sql`DELETE FROM recurrence_rules WHERE task_id = ${taskId}`;
    return true;
  });

  if (!deleted) {
    return c.json({ error: "No recurrence rule for this task" }, 404);
  }

  return c.json({ message: "Recurrence rule deleted, task is now one-time" });
});

// POST /api/recurrence/:taskId/complete - Complete recurring task and create next instance
recurrence.post("/:taskId/complete", async (c) => {
  const taskId = c.req.param("taskId");

  const result = await withTransaction(async (tx) => {
    // Get task and recurrence rule
    const [task] = await tx<Task[]>`SELECT * FROM tasks WHERE id = ${taskId}`;
    if (!task) {
      return { error: "Task not found", status: 404 };
    }

    const [rule] = await tx<RecurrenceRule[]>`
      SELECT * FROM recurrence_rules WHERE task_id = ${taskId}
    `;
    if (!rule) {
      return { error: "Task has no recurrence rule", status: 400 };
    }

    if (task.completed_at) {
      return { error: "Task already completed", status: 400 };
    }

    const completionDate = new Date();

    // Complete current task
    await tx`
      UPDATE tasks SET completed_at = ${completionDate}, updated_at = NOW()
      WHERE id = ${taskId}
    `;

    await logTaskActionTx(tx, {
      taskId,
      action: "completed",
      details: { title: task.title, recurring: true },
    });

    // Calculate next occurrence
    const nextDueDate = calculateNextOccurrence(rule, completionDate);

    // Get task contexts
    const contexts: { context_id: string }[] = await tx`
      SELECT context_id FROM task_contexts WHERE task_id = ${taskId}
    `;
    const contextIds = contexts.map(
      (c: { context_id: string }) => c.context_id,
    );

    // Create next task instance
    const [newTask] = await tx<Task[]>`
      INSERT INTO tasks (title, description, project_id, priority, due_date, must_do)
      VALUES (
        ${task.title},
        ${task.description},
        ${task.project_id},
        ${task.priority},
        ${nextDueDate.toISOString().split("T")[0]},
        ${task.must_do}
      )
      RETURNING *
    `;

    // Copy contexts to new task
    for (const contextId of contextIds) {
      await tx`
        INSERT INTO task_contexts (task_id, context_id)
        VALUES (${newTask.id}, ${contextId})
      `;
    }

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
      action: "created",
      details: {
        title: newTask.title,
        recurring: true,
        previousTaskId: taskId,
        dueDate: nextDueDate.toISOString(),
      },
    });

    return {
      completedTask: { ...task, completed_at: completionDate },
      nextTask: { ...newTask, context_ids: contextIds },
    };
  });

  if ("error" in result) {
    return c.json({ error: result.error }, result.status as 400 | 404 | 500);
  }

  return c.json(result);
});
