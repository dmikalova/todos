// Next Task API - Smart task suggestion with scoring algorithm

import { Hono } from "hono";
import { z } from "zod";
import { withDb } from "../db/index.ts";
import type { AppEnv } from "../types.ts";
import { type SqlQuery } from "../db/index.ts";

export const next = new Hono<AppEnv>();

// Zod schemas

const nextQuerySchema = z.object({
  contextId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  count: z.coerce.number().int().min(1).max(10).default(3),
});

// Types

interface Task {
  id: string;
  title: string;
  description: string | null;
  due_date: Date | null;
  deferred_until: Date | null;
  project_id: string | null;
  completed_at: Date | null;
  created_at: Date;
  context_ids: string[] | null;
}

interface ScoredTask extends Task {
  score: number;
  scoreBreakdown: {
    dueUrgency: number;
    age: number;
    contextMatch: number;
    projectMatch: number;
    random: number;
  };
}

// Scoring configuration
const SCORING = {
  // Due date urgency (higher = more urgent)
  OVERDUE_WEIGHT: 100, // Overdue tasks get highest priority
  DUE_TODAY_WEIGHT: 80,
  DUE_TOMORROW_WEIGHT: 60,
  DUE_THIS_WEEK_WEIGHT: 40,
  DUE_NEXT_WEEK_WEIGHT: 20,
  NO_DUE_DATE_WEIGHT: 10, // Small weight for undated tasks

  // Age weight (older tasks get slight priority bump)
  AGE_WEIGHT_PER_DAY: 0.5, // 0.5 points per day old
  MAX_AGE_WEIGHT: 20, // Cap at 20 points

  // Context matching
  CONTEXT_MATCH_WEIGHT: 30, // Bonus for matching current context

  // Project matching
  PROJECT_MATCH_WEIGHT: 20, // Bonus for matching selected project

  // Randomness (prevents always showing same tasks)
  RANDOM_WEIGHT: 15, // Max random addition
};

/**
 * Calculate task score for prioritization
 */
function scoreTask(
  task: Task,
  currentContextId?: string,
  selectedProjectId?: string,
): ScoredTask {
  const now = new Date();
  const breakdown = {
    dueUrgency: 0,
    age: 0,
    contextMatch: 0,
    projectMatch: 0,
    random: Math.random() * SCORING.RANDOM_WEIGHT,
  };

  // Due date urgency scoring
  if (task.due_date) {
    const dueDate = new Date(task.due_date);
    const daysUntilDue = Math.floor(
      (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntilDue < 0) {
      breakdown.dueUrgency = SCORING.OVERDUE_WEIGHT;
    } else if (daysUntilDue === 0) {
      breakdown.dueUrgency = SCORING.DUE_TODAY_WEIGHT;
    } else if (daysUntilDue === 1) {
      breakdown.dueUrgency = SCORING.DUE_TOMORROW_WEIGHT;
    } else if (daysUntilDue <= 7) {
      breakdown.dueUrgency = SCORING.DUE_THIS_WEEK_WEIGHT;
    } else if (daysUntilDue <= 14) {
      breakdown.dueUrgency = SCORING.DUE_NEXT_WEEK_WEIGHT;
    }
  } else {
    breakdown.dueUrgency = SCORING.NO_DUE_DATE_WEIGHT;
  }

  // Age scoring (older tasks get slight bump to prevent stagnation)
  const ageInDays = Math.floor(
    (now.getTime() - new Date(task.created_at).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  breakdown.age = Math.min(
    ageInDays * SCORING.AGE_WEIGHT_PER_DAY,
    SCORING.MAX_AGE_WEIGHT,
  );

  // Context match scoring
  if (
    currentContextId &&
    task.context_ids &&
    task.context_ids.includes(currentContextId)
  ) {
    breakdown.contextMatch = SCORING.CONTEXT_MATCH_WEIGHT;
  }

  // Project match scoring
  if (selectedProjectId && task.project_id === selectedProjectId) {
    breakdown.projectMatch = SCORING.PROJECT_MATCH_WEIGHT;
  }

  const score = breakdown.dueUrgency +
    breakdown.age +
    breakdown.contextMatch +
    breakdown.projectMatch +
    breakdown.random;

  return {
    ...task,
    score: Math.round(score * 100) / 100,
    scoreBreakdown: {
      ...breakdown,
      random: Math.round(breakdown.random * 100) / 100,
    },
  };
}

// GET /api/next - Get next recommended tasks
next.get("/", async (c) => {
  const query = c.req.query();
  const result = nextQuerySchema.safeParse(query);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { contextId, projectId, count } = result.data;

  const tasks = await withDb(async (sql: SqlQuery) => {
    // Get current context if not specified
    let currentContextId = contextId;

    if (!currentContextId) {
      // Try to detect current context based on time windows
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0 = Sunday
      const currentTime = `${now.getHours().toString().padStart(2, "0")}:${
        now.getMinutes().toString().padStart(2, "0")
      }:00`;

      const [currentContext] = await sql<{ id: string }[]>`
        SELECT DISTINCT c.id
        FROM contexts c
        JOIN context_time_windows tw ON c.id = tw.context_id
        WHERE tw.day_of_week = ${dayOfWeek}
          AND tw.start_time <= ${currentTime}::time
          AND tw.end_time > ${currentTime}::time
        LIMIT 1
      `;

      currentContextId = currentContext?.id;
    }

    // Fetch eligible tasks (not completed, not deleted, not deferred)
    const eligibleTasks = await sql<Task[]>`
      SELECT t.*, 
        ARRAY_AGG(DISTINCT tc.context_id) FILTER (WHERE tc.context_id IS NOT NULL) as context_ids
      FROM tasks t
      LEFT JOIN task_contexts tc ON t.id = tc.task_id
      WHERE t.completed_at IS NULL
        AND t.deleted_at IS NULL
        AND (t.deferred_until IS NULL OR t.deferred_until <= NOW())
      GROUP BY t.id
    `;

    // Score and sort tasks
    const scoredTasks = eligibleTasks.map((task) =>
      scoreTask(task, currentContextId, projectId)
    );

    scoredTasks.sort((a, b) => b.score - a.score);

    return {
      currentContextId,
      tasks: scoredTasks.slice(0, count),
      totalEligible: eligibleTasks.length,
    };
  });

  return c.json(tasks);
});

// GET /api/next/random - Get a single random task (weighted by score)
next.get("/random", async (c) => {
  const query = c.req.query();
  const contextId = query.contextId;
  const projectId = query.projectId;

  const task = await withDb(async (sql: SqlQuery) => {
    // Fetch eligible tasks
    const eligibleTasks = await sql<Task[]>`
      SELECT t.*, 
        ARRAY_AGG(DISTINCT tc.context_id) FILTER (WHERE tc.context_id IS NOT NULL) as context_ids
      FROM tasks t
      LEFT JOIN task_contexts tc ON t.id = tc.task_id
      WHERE t.completed_at IS NULL
        AND t.deleted_at IS NULL
        AND (t.deferred_until IS NULL OR t.deferred_until <= NOW())
      GROUP BY t.id
    `;

    if (eligibleTasks.length === 0) {
      return null;
    }

    // Score all tasks
    const scoredTasks = eligibleTasks.map((t) =>
      scoreTask(t, contextId, projectId)
    );

    // Weighted random selection
    const totalScore = scoredTasks.reduce((sum, t) => sum + t.score, 0);
    let random = Math.random() * totalScore;

    for (const t of scoredTasks) {
      random -= t.score;
      if (random <= 0) {
        return t;
      }
    }

    // Fallback to first (shouldn't happen)
    return scoredTasks[0];
  });

  if (!task) {
    return c.json({ message: "No eligible tasks found", task: null });
  }

  return c.json({ task });
});

// GET /api/next/explain - Explain scoring for a specific task
next.get("/explain/:taskId", async (c) => {
  const taskId = c.req.param("taskId");
  const query = c.req.query();
  const contextId = query.contextId;
  const projectId = query.projectId;

  const result = await withDb(async (sql: SqlQuery) => {
    const [task] = await sql<Task[]>`
      SELECT t.*, 
        ARRAY_AGG(DISTINCT tc.context_id) FILTER (WHERE tc.context_id IS NOT NULL) as context_ids
      FROM tasks t
      LEFT JOIN task_contexts tc ON t.id = tc.task_id
      WHERE t.id = ${taskId}
      GROUP BY t.id
    `;

    if (!task) return null;

    const scored = scoreTask(task, contextId, projectId);

    return {
      task: scored,
      explanation: {
        dueUrgency: describeDueUrgency(task.due_date),
        age: `Task is ${
          Math.floor(
            (Date.now() - new Date(task.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          )
        } days old`,
        contextMatch: contextId
          ? task.context_ids?.includes(contextId)
            ? "Matches current context"
            : "Does not match current context"
          : "No context filter applied",
        projectMatch: projectId
          ? task.project_id === projectId
            ? "Matches selected project"
            : "Does not match selected project"
          : "No project filter applied",
        random: "Small random factor to prevent stagnation",
      },
      scoringConfig: SCORING,
    };
  });

  if (!result) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(result);
});

function describeDueUrgency(dueDate: Date | null): string {
  if (!dueDate) {
    return "No due date - minimal urgency weight";
  }

  const now = new Date();
  const due = new Date(dueDate);
  const daysUntil = Math.floor(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntil < 0) {
    return `Overdue by ${Math.abs(daysUntil)} days - highest urgency`;
  }
  if (daysUntil === 0) return "Due today - high urgency";
  if (daysUntil === 1) return "Due tomorrow - elevated urgency";
  if (daysUntil <= 7) return `Due in ${daysUntil} days - moderate urgency`;
  if (daysUntil <= 14) return `Due in ${daysUntil} days - low urgency`;
  return `Due in ${daysUntil} days - minimal urgency`;
}
