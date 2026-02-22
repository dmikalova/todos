// Import API - Import data from various formats

import { Hono } from "hono";
import { z } from "zod";
import { withTransaction } from "../db/index.ts";
import type { AppEnv } from "../types.ts";

export const importRoutes = new Hono<AppEnv>();

// Zod schemas for import validation

const timeWindowSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

const projectSchema = z.object({
  id: z.string().uuid().optional(), // Optional - will generate if not provided
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
});

const contextSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(1000).nullable().optional(),
  time_windows: z.array(timeWindowSchema).optional(),
});

const recurrenceSchema = z.object({
  schedule_type: z.enum(["fixed", "completion"]),
  frequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  interval: z.number().int().min(1).default(1),
  day_of_week: z.number().int().min(0).max(6).nullable().optional(),
  day_of_month: z.number().int().min(1).max(31).nullable().optional(),
  month_of_year: z.number().int().min(1).max(12).nullable().optional(),
});

const taskSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  due_date: z.string().datetime().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  contexts: z.array(z.string().uuid()).optional(), // Context IDs
  recurrence: recurrenceSchema.nullable().optional(),
});

const importDataSchema = z.object({
  version: z.string().optional(),
  projects: z.array(projectSchema).optional(),
  contexts: z.array(contextSchema).optional(),
  tasks: z.array(taskSchema).optional(),
});

const importOptionsSchema = z.object({
  mode: z.enum(["merge", "replace"]).default("merge"),
  skipDuplicates: z.boolean().default(true),
});

// Types

interface ImportResult {
  success: boolean;
  imported: {
    projects: number;
    contexts: number;
    tasks: number;
  };
  skipped: {
    projects: number;
    contexts: number;
    tasks: number;
  };
  errors: string[];
}

// POST /api/import - Import full data
importRoutes.post("/", async (c) => {
  const body = await c.req.json();

  // Parse options from query string
  const query = c.req.query();
  const optionsResult = importOptionsSchema.safeParse({
    mode: query.mode,
    skipDuplicates: query.skipDuplicates === "true",
  });

  if (!optionsResult.success) {
    return c.json(
      { error: "Invalid options", details: optionsResult.error.issues },
      400,
    );
  }

  const options = optionsResult.data;

  // Validate import data
  const dataResult = importDataSchema.safeParse(body);

  if (!dataResult.success) {
    return c.json(
      { error: "Invalid import data", details: dataResult.error.issues },
      400,
    );
  }

  const data = dataResult.data;
  const result: ImportResult = {
    success: true,
    imported: { projects: 0, contexts: 0, tasks: 0 },
    skipped: { projects: 0, contexts: 0, tasks: 0 },
    errors: [],
  };

  // Maps of old IDs to new IDs (for when we generate new UUIDs)
  const projectIdMap = new Map<string, string>();
  const contextIdMap = new Map<string, string>();

  try {
    await withTransaction(async (tx) => {
      // If replace mode, clear existing data
      if (options.mode === "replace") {
        await tx`DELETE FROM task_contexts`;
        await tx`DELETE FROM recurrence_rules`;
        await tx`DELETE FROM task_history`;
        await tx`DELETE FROM tasks`;
        await tx`DELETE FROM context_time_windows`;
        await tx`DELETE FROM contexts`;
        await tx`DELETE FROM projects`;
      }

      // Import projects
      if (data.projects) {
        for (const project of data.projects) {
          try {
            if (options.skipDuplicates && options.mode === "merge") {
              // Check for existing project with same name
              const [existing] = await tx<{ id: string }[]>`
                SELECT id FROM projects WHERE name = ${project.name}
              `;
              if (existing) {
                projectIdMap.set(project.id || project.name, existing.id);
                result.skipped.projects++;
                continue;
              }
            }

            const [created] = await tx<{ id: string }[]>`
              INSERT INTO projects (name, description)
              VALUES (${project.name}, ${project.description || null})
              RETURNING id
            `;
            projectIdMap.set(project.id || project.name, created.id);
            result.imported.projects++;
          } catch (err) {
            result.errors.push(
              `Failed to import project "${project.name}": ${err}`,
            );
          }
        }
      }

      // Import contexts
      if (data.contexts) {
        for (const context of data.contexts) {
          try {
            if (options.skipDuplicates && options.mode === "merge") {
              const [existing] = await tx<{ id: string }[]>`
                SELECT id FROM contexts WHERE name = ${context.name}
              `;
              if (existing) {
                contextIdMap.set(context.id || context.name, existing.id);
                result.skipped.contexts++;
                continue;
              }
            }

            const [created] = await tx<{ id: string }[]>`
              INSERT INTO contexts (name, description)
              VALUES (${context.name}, ${context.description || null})
              RETURNING id
            `;
            contextIdMap.set(context.id || context.name, created.id);

            // Insert time windows
            if (context.time_windows && context.time_windows.length > 0) {
              for (const tw of context.time_windows) {
                await tx`
                  INSERT INTO context_time_windows (context_id, day_of_week, start_time, end_time)
                  VALUES (${created.id}, ${tw.day_of_week}, ${tw.start_time}, ${tw.end_time})
                `;
              }
            }

            result.imported.contexts++;
          } catch (err) {
            result.errors.push(
              `Failed to import context "${context.name}": ${err}`,
            );
          }
        }
      }

      // Import tasks
      if (data.tasks) {
        for (const task of data.tasks) {
          try {
            // Resolve project ID
            const resolvedProjectId = task.project_id
              ? projectIdMap.get(task.project_id) || task.project_id
              : null;

            // Check for duplicate (by title and project)
            if (options.skipDuplicates && options.mode === "merge") {
              const [existing] = await tx<{ id: string }[]>`
                SELECT id FROM tasks
                WHERE title = ${task.title}
                  AND (project_id = ${resolvedProjectId} OR (project_id IS NULL AND ${resolvedProjectId} IS NULL))
                  AND deleted_at IS NULL
              `;
              if (existing) {
                result.skipped.tasks++;
                continue;
              }
            }

            const [created] = await tx<{ id: string }[]>`
              INSERT INTO tasks (title, description, due_date, project_id)
              VALUES (
                ${task.title},
                ${task.description || null},
                ${task.due_date || null},
                ${resolvedProjectId}
              )
              RETURNING id
            `;

            // Add context associations
            if (task.contexts && task.contexts.length > 0) {
              for (const ctxId of task.contexts) {
                const resolvedCtxId = contextIdMap.get(ctxId) || ctxId;
                await tx`
                  INSERT INTO task_contexts (task_id, context_id)
                  VALUES (${created.id}, ${resolvedCtxId})
                  ON CONFLICT DO NOTHING
                `;
              }
            }

            // Add recurrence rule
            if (task.recurrence) {
              await tx`
                INSERT INTO recurrence_rules (
                  task_id, schedule_type, frequency, interval,
                  day_of_week, day_of_month, month_of_year
                )
                VALUES (
                  ${created.id},
                  ${task.recurrence.schedule_type},
                  ${task.recurrence.frequency},
                  ${task.recurrence.interval},
                  ${task.recurrence.day_of_week || null},
                  ${task.recurrence.day_of_month || null},
                  ${task.recurrence.month_of_year || null}
                )
              `;
            }

            result.imported.tasks++;
          } catch (err) {
            result.errors.push(`Failed to import task "${task.title}": ${err}`);
          }
        }
      }
    });
  } catch (err) {
    result.success = false;
    result.errors.push(`Transaction failed: ${err}`);
  }

  const status = result.success && result.errors.length === 0 ? 200 : 207; // 207 Multi-Status for partial success
  return c.json(result, status);
});

// POST /api/import/tasks - Import just tasks (simple format)
importRoutes.post("/tasks", async (c) => {
  const body = await c.req.json();

  const tasksArraySchema = z.object({
    tasks: z.array(
      z.object({
        title: z.string().min(1),
        description: z.string().optional(),
        due_date: z.string().datetime().optional(),
      }),
    ),
  });

  const result = tasksArraySchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Invalid format", details: result.error.issues },
      400,
    );
  }

  const { tasks } = result.data;
  let imported = 0;
  const errors: string[] = [];

  await withTransaction(async (tx) => {
    for (const task of tasks) {
      try {
        await tx`
          INSERT INTO tasks (title, description, due_date)
          VALUES (${task.title}, ${task.description || null}, ${
          task.due_date || null
        })
        `;
        imported++;
      } catch (err) {
        errors.push(`Failed to import "${task.title}": ${err}`);
      }
    }
  });

  return c.json({
    success: errors.length === 0,
    imported,
    failed: tasks.length - imported,
    errors,
  });
});

// POST /api/import/todoist - Import from Todoist JSON export format
// This is a stub that can be expanded to support Todoist's specific format
importRoutes.post("/todoist", (c) => {
  // Todoist export format handling would go here
  // For now, return not implemented
  return c.json(
    {
      error:
        "Todoist import not yet implemented. Use /api/import with standard format.",
    },
    501,
  );
});
