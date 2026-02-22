// Unit tests for task scoring service

import { assertAlmostEquals, assertEquals } from "@std/assert";
import {
  getNextTasks,
  isTaskEligible,
  scoreTask,
  SCORING,
  type TaskForScoring,
} from "../../src/services/scoring.ts";

// Helper to create a basic task
function createTask(overrides: Partial<TaskForScoring> = {}): TaskForScoring {
  return {
    id: "test-task-" + Math.random().toString(36).slice(2),
    due_date: null,
    deferred_until: null,
    project_id: null,
    completed_at: null,
    created_at: new Date("2026-02-01"),
    context_ids: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Due Date Scoring Tests
// ---------------------------------------------------------------------------

Deno.test("scoreTask - overdue task gets highest due urgency", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ due_date: new Date("2026-02-15") }); // 6 days ago

  const result = scoreTask(task, { now, randomValue: 0 });

  assertEquals(result.scoreBreakdown.dueUrgency, SCORING.OVERDUE_WEIGHT);
});

Deno.test("scoreTask - due today gets DUE_TODAY weight", () => {
  const now = new Date("2026-02-21T12:00:00");
  const task = createTask({ due_date: new Date("2026-02-21T23:59:59") });

  const result = scoreTask(task, { now, randomValue: 0 });

  assertEquals(result.scoreBreakdown.dueUrgency, SCORING.DUE_TODAY_WEIGHT);
});

Deno.test("scoreTask - due tomorrow gets DUE_TOMORROW weight", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ due_date: new Date("2026-02-22") });

  const result = scoreTask(task, { now, randomValue: 0 });

  assertEquals(result.scoreBreakdown.dueUrgency, SCORING.DUE_TOMORROW_WEIGHT);
});

Deno.test("scoreTask - due in 5 days gets DUE_THIS_WEEK weight", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ due_date: new Date("2026-02-26") });

  const result = scoreTask(task, { now, randomValue: 0 });

  assertEquals(result.scoreBreakdown.dueUrgency, SCORING.DUE_THIS_WEEK_WEIGHT);
});

Deno.test("scoreTask - due in 10 days gets DUE_NEXT_WEEK weight", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ due_date: new Date("2026-03-03") });

  const result = scoreTask(task, { now, randomValue: 0 });

  assertEquals(result.scoreBreakdown.dueUrgency, SCORING.DUE_NEXT_WEEK_WEIGHT);
});

Deno.test("scoreTask - no due date gets NO_DUE_DATE weight", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ due_date: null });

  const result = scoreTask(task, { now, randomValue: 0 });

  assertEquals(result.scoreBreakdown.dueUrgency, SCORING.NO_DUE_DATE_WEIGHT);
});

// ---------------------------------------------------------------------------
// Age Scoring Tests
// ---------------------------------------------------------------------------

Deno.test("scoreTask - new task has zero age weight", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ created_at: new Date("2026-02-21") });

  const result = scoreTask(task, { now, randomValue: 0 });

  assertEquals(result.scoreBreakdown.age, 0);
});

Deno.test("scoreTask - 10-day-old task gets proportional age weight", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ created_at: new Date("2026-02-11") }); // 10 days ago

  const result = scoreTask(task, { now, randomValue: 0 });

  assertEquals(result.scoreBreakdown.age, 10 * SCORING.AGE_WEIGHT_PER_DAY);
});

Deno.test("scoreTask - age weight is capped at MAX_AGE_WEIGHT", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ created_at: new Date("2025-01-01") }); // Very old

  const result = scoreTask(task, { now, randomValue: 0 });

  assertEquals(result.scoreBreakdown.age, SCORING.MAX_AGE_WEIGHT);
});

// ---------------------------------------------------------------------------
// Context Matching Tests
// ---------------------------------------------------------------------------

Deno.test("scoreTask - matching context gets bonus", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ context_ids: ["ctx-1", "ctx-2"] });

  const result = scoreTask(task, {
    now,
    randomValue: 0,
    currentContextId: "ctx-1",
  });

  assertEquals(
    result.scoreBreakdown.contextMatch,
    SCORING.CONTEXT_MATCH_WEIGHT,
  );
});

Deno.test("scoreTask - non-matching context gets no bonus", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ context_ids: ["ctx-1"] });

  const result = scoreTask(task, {
    now,
    randomValue: 0,
    currentContextId: "ctx-other",
  });

  assertEquals(result.scoreBreakdown.contextMatch, 0);
});

Deno.test("scoreTask - null context_ids gets no bonus", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ context_ids: null });

  const result = scoreTask(task, {
    now,
    randomValue: 0,
    currentContextId: "ctx-1",
  });

  assertEquals(result.scoreBreakdown.contextMatch, 0);
});

// ---------------------------------------------------------------------------
// Project Matching Tests
// ---------------------------------------------------------------------------

Deno.test("scoreTask - matching project gets bonus", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ project_id: "proj-1" });

  const result = scoreTask(task, {
    now,
    randomValue: 0,
    selectedProjectId: "proj-1",
  });

  assertEquals(
    result.scoreBreakdown.projectMatch,
    SCORING.PROJECT_MATCH_WEIGHT,
  );
});

Deno.test("scoreTask - non-matching project gets no bonus", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ project_id: "proj-1" });

  const result = scoreTask(task, {
    now,
    randomValue: 0,
    selectedProjectId: "proj-other",
  });

  assertEquals(result.scoreBreakdown.projectMatch, 0);
});

// ---------------------------------------------------------------------------
// Random Factor Tests
// ---------------------------------------------------------------------------

Deno.test("scoreTask - random factor adds variability", () => {
  const now = new Date("2026-02-21");
  const task = createTask({ created_at: now });

  const result1 = scoreTask(task, { now, randomValue: 0 });
  const result2 = scoreTask(task, { now, randomValue: 1 });

  // Difference should be approximately RANDOM_WEIGHT
  const diff = result2.score - result1.score;
  assertAlmostEquals(diff, SCORING.RANDOM_WEIGHT, 0.01);
});

// ---------------------------------------------------------------------------
// isTaskEligible Tests
// ---------------------------------------------------------------------------

Deno.test("isTaskEligible - completed task is not eligible", () => {
  const task = createTask({ completed_at: new Date("2026-02-20") });

  const result = isTaskEligible(task);

  assertEquals(result, false);
});

Deno.test(
  "isTaskEligible - deferred task is not eligible before defer date",
  () => {
    const now = new Date("2026-02-21");
    const task = createTask({ deferred_until: new Date("2026-02-25") });

    const result = isTaskEligible(task, { now });

    assertEquals(result, false);
  },
);

Deno.test("isTaskEligible - deferred task is eligible after defer date", () => {
  const now = new Date("2026-02-25");
  const task = createTask({ deferred_until: new Date("2026-02-21") });

  const result = isTaskEligible(task, { now });

  assertEquals(result, true);
});

Deno.test(
  "isTaskEligible - task without contexts is always eligible for context filter",
  () => {
    const task = createTask({ context_ids: null });

    const result = isTaskEligible(task, { currentContextId: "ctx-1" });

    assertEquals(result, true);
  },
);

Deno.test("isTaskEligible - task with matching context is eligible", () => {
  const task = createTask({ context_ids: ["ctx-1", "ctx-2"] });

  const result = isTaskEligible(task, { currentContextId: "ctx-1" });

  assertEquals(result, true);
});

Deno.test(
  "isTaskEligible - task without matching context is not eligible",
  () => {
    const task = createTask({ context_ids: ["ctx-1"] });

    const result = isTaskEligible(task, { currentContextId: "ctx-other" });

    assertEquals(result, false);
  },
);

// ---------------------------------------------------------------------------
// getNextTasks Tests
// ---------------------------------------------------------------------------

Deno.test("getNextTasks - returns tasks sorted by score", () => {
  const now = new Date("2026-02-21");
  const tasks = [
    createTask({ id: "low", due_date: null, created_at: now }), // Low score
    createTask({ id: "high", due_date: new Date("2026-02-15") }), // Overdue = high score
    createTask({ id: "medium", due_date: new Date("2026-02-21") }), // Due today
  ];

  // Use randomValue: 0 for determinism by mocking scoreTask behavior
  const results = getNextTasks(tasks, { now });

  // Verify ordering: "high" should be first (overdue), then "medium" (due today)
  assertEquals(results[0].task.id, "high");
  assertEquals(results[1].task.id, "medium");
});

Deno.test("getNextTasks - filters out completed tasks", () => {
  const now = new Date("2026-02-21");
  const tasks = [
    createTask({ id: "open" }),
    createTask({ id: "completed", completed_at: new Date() }),
  ];

  const results = getNextTasks(tasks, { now });

  assertEquals(results.length, 1);
  assertEquals(results[0].task.id, "open");
});

Deno.test("getNextTasks - respects limit parameter", () => {
  const now = new Date("2026-02-21");
  const tasks = [
    createTask({ id: "1" }),
    createTask({ id: "2" }),
    createTask({ id: "3" }),
  ];

  const results = getNextTasks(tasks, { now, limit: 2 });

  assertEquals(results.length, 2);
});

Deno.test("getNextTasks - filters by context", () => {
  const now = new Date("2026-02-21");
  const tasks = [
    createTask({ id: "work", context_ids: ["work-ctx"] }),
    createTask({ id: "home", context_ids: ["home-ctx"] }),
    createTask({ id: "any", context_ids: null }), // No context = always eligible
  ];

  const results = getNextTasks(tasks, { now, currentContextId: "work-ctx" });

  // Should include "work" and "any", but not "home"
  const ids = results.map((r) => r.task.id);
  assertEquals(ids.includes("work"), true);
  assertEquals(ids.includes("any"), true);
  assertEquals(ids.includes("home"), false);
});
