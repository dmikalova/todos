// Task scoring service for the Next page
// Extracted for testability

export interface TaskForScoring {
  id: string;
  due_date: Date | string | null;
  deferred_until: Date | string | null;
  project_id: string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  context_ids: string[] | null;
}

export interface ScoreBreakdown {
  dueUrgency: number;
  age: number;
  contextMatch: number;
  projectMatch: number;
  random: number;
}

export interface ScoredTask<T extends TaskForScoring = TaskForScoring> {
  task: T;
  score: number;
  scoreBreakdown: ScoreBreakdown;
}

// Scoring configuration
export const SCORING = {
  // Due date urgency (higher = more urgent)
  OVERDUE_WEIGHT: 100,
  DUE_TODAY_WEIGHT: 80,
  DUE_TOMORROW_WEIGHT: 60,
  DUE_THIS_WEEK_WEIGHT: 40,
  DUE_NEXT_WEEK_WEIGHT: 20,
  NO_DUE_DATE_WEIGHT: 10,

  // Age weight
  AGE_WEIGHT_PER_DAY: 0.5,
  MAX_AGE_WEIGHT: 20,

  // Context and project matching
  CONTEXT_MATCH_WEIGHT: 30,
  PROJECT_MATCH_WEIGHT: 20,

  // Randomness
  RANDOM_WEIGHT: 15,
} as const;

/**
 * Calculate task score for prioritization
 *
 * @param task - The task to score
 * @param options - Scoring options
 * @param options.currentContextId - Current active context ID (for matching bonus)
 * @param options.selectedProjectId - Selected project ID (for matching bonus)
 * @param options.now - Current date (for testing, defaults to now)
 * @param options.randomValue - Random value 0-1 (for testing determinism)
 */
export function scoreTask<T extends TaskForScoring>(
  task: T,
  options: {
    currentContextId?: string;
    selectedProjectId?: string;
    now?: Date;
    randomValue?: number;
  } = {},
): ScoredTask<T> {
  const now = options.now ?? new Date();
  const randomValue = options.randomValue ?? Math.random();

  const breakdown: ScoreBreakdown = {
    dueUrgency: 0,
    age: 0,
    contextMatch: 0,
    projectMatch: 0,
    random: randomValue * SCORING.RANDOM_WEIGHT,
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

  // Age scoring
  const createdAt = new Date(task.created_at);
  const ageInDays = Math.floor(
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  breakdown.age = Math.min(
    ageInDays * SCORING.AGE_WEIGHT_PER_DAY,
    SCORING.MAX_AGE_WEIGHT,
  );

  // Context match scoring
  if (
    options.currentContextId &&
    task.context_ids &&
    task.context_ids.includes(options.currentContextId)
  ) {
    breakdown.contextMatch = SCORING.CONTEXT_MATCH_WEIGHT;
  }

  // Project match scoring
  if (
    options.selectedProjectId &&
    task.project_id === options.selectedProjectId
  ) {
    breakdown.projectMatch = SCORING.PROJECT_MATCH_WEIGHT;
  }

  const score = breakdown.dueUrgency +
    breakdown.age +
    breakdown.contextMatch +
    breakdown.projectMatch +
    breakdown.random;

  return {
    task,
    score: Math.round(score * 100) / 100,
    scoreBreakdown: {
      ...breakdown,
      random: Math.round(breakdown.random * 100) / 100,
    },
  };
}

/**
 * Check if a task is eligible for the Next page
 *
 * @param task - The task to check
 * @param options - Eligibility options
 * @param options.now - Current date
 * @param options.currentContextId - Current active context ID
 */
export function isTaskEligible(
  task: TaskForScoring,
  options: {
    now?: Date;
    currentContextId?: string;
  } = {},
): boolean {
  const now = options.now ?? new Date();

  // Must not be completed
  if (task.completed_at) {
    return false;
  }

  // Must not be deferred to the future
  if (task.deferred_until) {
    const deferredUntil = new Date(task.deferred_until);
    if (deferredUntil > now) {
      return false;
    }
  }

  // Context matching: task is eligible if:
  // - No context filter specified (show all)
  // - Task has no contexts (works for any context)
  // - Task's contexts include the current context
  if (
    options.currentContextId &&
    task.context_ids &&
    task.context_ids.length > 0
  ) {
    if (!task.context_ids.includes(options.currentContextId)) {
      return false;
    }
  }

  return true;
}

/**
 * Score and filter tasks for the Next page
 *
 * @param tasks - All tasks to consider
 * @param options - Scoring and filtering options
 * @returns Sorted array of eligible scored tasks (highest score first)
 */
export function getNextTasks<T extends TaskForScoring>(
  tasks: T[],
  options: {
    currentContextId?: string;
    selectedProjectId?: string;
    now?: Date;
    limit?: number;
  } = {},
): ScoredTask<T>[] {
  const now = options.now ?? new Date();

  // Filter eligible tasks
  const eligible = tasks.filter((task) =>
    isTaskEligible(task, { now, currentContextId: options.currentContextId })
  );

  // Score all eligible tasks
  const scored = eligible.map((task) =>
    scoreTask(task, {
      currentContextId: options.currentContextId,
      selectedProjectId: options.selectedProjectId,
      now,
    })
  );

  // Sort by score (highest first)
  scored.sort((a, b) => b.score - a.score);

  // Apply limit if specified
  if (options.limit && options.limit > 0) {
    return scored.slice(0, options.limit);
  }

  return scored;
}
