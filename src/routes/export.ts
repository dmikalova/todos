// Export API - Export data in various formats

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb } from "../db/index.ts";
import type { AppEnv } from "../types.ts";

export const exportRoutes = new Hono<AppEnv>();

// Zod schemas

const exportQuerySchema = z.object({
  format: z.enum(["json", "csv"]).default("json"),
  includeCompleted: z.coerce.boolean().default(false),
  includeDeleted: z.coerce.boolean().default(false),
  projectId: z.string().uuid().optional(),
  contextId: z.string().uuid().optional(),
});

// Types

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: Date | null;
  due_date_original: Date | null;
  deferred_until: Date | null;
  project_id: string | null;
  completed_at: Date | null;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
}

interface Context {
  id: string;
  name: string;
  description: string | null;
  created_at: Date;
  time_windows: TimeWindow[];
}

interface TimeWindow {
  day_of_week: number;
  start_time: string;
  end_time: string;
}

interface RecurrenceRule {
  id: string;
  task_id: string;
  schedule_type: string;
  frequency: string;
  interval: number;
  day_of_week: number | null;
  day_of_month: number | null;
  month_of_year: number | null;
  created_at: Date;
}

interface ExportData {
  exportedAt: string;
  version: string;
  projects: Project[];
  contexts: Context[];
  tasks: (Task & { contexts: string[]; recurrence?: RecurrenceRule | null })[];
}

// GET /api/export - Export all data
exportRoutes.get("/", async (c) => {
  const query = c.req.query();
  const result = exportQuerySchema.safeParse(query);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { format, includeCompleted, includeDeleted, projectId, contextId } =
    result.data;

  const data = await withDb(async (sql: SqlQuery) => {
    // Export projects
    const projects = await sql<Project[]>`SELECT * FROM projects ORDER BY name`;

    // Export contexts with time windows
    const contexts = await sql<(Context & { time_windows: TimeWindow[] })[]>`
      SELECT c.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'day_of_week', tw.day_of_week,
              'start_time', tw.start_time::text,
              'end_time', tw.end_time::text
            )
          ) FILTER (WHERE tw.id IS NOT NULL),
          '[]'
        ) as time_windows
      FROM contexts c
      LEFT JOIN context_time_windows tw ON c.id = tw.context_id
      GROUP BY c.id
      ORDER BY c.name
    `;

    // Build task query conditions
    let tasks: Task[];

    if (includeDeleted && includeCompleted) {
      tasks = await sql<Task[]>`SELECT * FROM tasks ORDER BY created_at`;
    } else if (includeCompleted) {
      tasks = await sql<
        Task[]
      >`SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY created_at`;
    } else if (includeDeleted) {
      tasks = await sql<
        Task[]
      >`SELECT * FROM tasks WHERE completed_at IS NULL ORDER BY created_at`;
    } else {
      tasks = await sql<Task[]>`
        SELECT * FROM tasks
        WHERE deleted_at IS NULL AND completed_at IS NULL
        ORDER BY created_at
      `;
    }

    // Apply optional filters
    if (projectId) {
      tasks = tasks.filter((t) => t.project_id === projectId);
    }

    // Get task contexts
    const taskContexts = await sql<{ task_id: string; context_id: string }[]>`
      SELECT task_id, context_id FROM task_contexts
    `;
    const taskContextMap = new Map<string, string[]>();
    for (const tc of taskContexts) {
      if (!taskContextMap.has(tc.task_id)) {
        taskContextMap.set(tc.task_id, []);
      }
      taskContextMap.get(tc.task_id)!.push(tc.context_id);
    }

    // Apply context filter after joining
    if (contextId) {
      tasks = tasks.filter((t) => {
        const ctxIds = taskContextMap.get(t.id) || [];
        return ctxIds.includes(contextId);
      });
    }

    // Get recurrence rules
    const recurrenceRules = await sql<
      RecurrenceRule[]
    >`SELECT * FROM recurrence_rules`;
    const recurrenceMap = new Map<string, RecurrenceRule>();
    for (const rule of recurrenceRules) {
      recurrenceMap.set(rule.task_id, rule);
    }

    // Combine task data
    const enrichedTasks = tasks.map((task) => ({
      ...task,
      contexts: taskContextMap.get(task.id) || [],
      recurrence: recurrenceMap.get(task.id) || null,
    }));

    return {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      projects,
      contexts,
      tasks: enrichedTasks,
    } as ExportData;
  });

  if (format === "csv") {
    // Convert to CSV format (tasks only for CSV)
    const csv = tasksToCSV(data.tasks);
    c.header("Content-Type", "text/csv");
    c.header(
      "Content-Disposition",
      `attachment; filename="todos-export-${Date.now()}.csv"`,
    );
    return c.body(csv);
  }

  // JSON format
  c.header("Content-Type", "application/json");
  c.header(
    "Content-Disposition",
    `attachment; filename="todos-export-${Date.now()}.json"`,
  );
  return c.json(data);
});

// GET /api/export/tasks - Export just tasks
exportRoutes.get("/tasks", async (c) => {
  const query = c.req.query();
  const format = query.format || "json";

  const tasks = await withDb(async (sql: SqlQuery) => {
    return await sql<Task[]>`
      SELECT * FROM tasks
      WHERE deleted_at IS NULL
      ORDER BY created_at
    `;
  });

  if (format === "csv") {
    const csv = tasksToCSV(tasks);
    c.header("Content-Type", "text/csv");
    c.header(
      "Content-Disposition",
      `attachment; filename="tasks-${Date.now()}.csv"`,
    );
    return c.body(csv);
  }

  return c.json({ tasks, exportedAt: new Date().toISOString() });
});

// GET /api/export/projects - Export just projects
exportRoutes.get("/projects", async (c) => {
  const projects = await withDb(async (sql: SqlQuery) => {
    return await sql<Project[]>`SELECT * FROM projects ORDER BY name`;
  });

  return c.json({ projects, exportedAt: new Date().toISOString() });
});

// GET /api/export/contexts - Export just contexts
exportRoutes.get("/contexts", async (c) => {
  const contexts = await withDb(async (sql: SqlQuery) => {
    return await sql<Context[]>`
      SELECT c.*,
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'day_of_week', tw.day_of_week,
              'start_time', tw.start_time::text,
              'end_time', tw.end_time::text
            )
          ) FILTER (WHERE tw.id IS NOT NULL),
          '[]'
        ) as time_windows
      FROM contexts c
      LEFT JOIN context_time_windows tw ON c.id = tw.context_id
      GROUP BY c.id
      ORDER BY c.name
    `;
  });

  return c.json({ contexts, exportedAt: new Date().toISOString() });
});

/**
 * Convert tasks array to CSV format
 */
function tasksToCSV(tasks: Task[]): string {
  const headers = [
    "id",
    "title",
    "description",
    "due_date",
    "deferred_until",
    "project_id",
    "completed_at",
    "created_at",
  ];

  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = tasks.map((task) =>
    headers
      .map((h) => escapeCSV((task as unknown as Record<string, unknown>)[h]))
      .join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}
