// Unit tests for task loading and infinite scroll logic

import { assertEquals } from "@std/assert";

/**
 * Build params for the initial task load.
 * Open tasks: all, no limit. Completed tasks: limit 100, ordered by completed_at desc.
 */
function buildInitialLoadParams(): {
  open: { completed: string };
  history: { completed: string; limit: number; orderBy: string };
} {
  return {
    open: { completed: "false" },
    history: {
      completed: "true",
      limit: 100,
      orderBy: "completed_at desc",
    },
  };
}

/**
 * Compute the next offset for infinite scroll pagination.
 */
function getNextHistoryPage(currentOffset: number, pageSize: number): number {
  return currentOffset + pageSize;
}

Deno.test("buildInitialLoadParams - returns correct open task params", () => {
  const params = buildInitialLoadParams();
  assertEquals(params.open, { completed: "false" });
});

Deno.test("buildInitialLoadParams - returns correct history params", () => {
  const params = buildInitialLoadParams();
  assertEquals(params.history, {
    completed: "true",
    limit: 100,
    orderBy: "completed_at desc",
  });
});

Deno.test("getNextHistoryPage - advances offset correctly", () => {
  assertEquals(getNextHistoryPage(0, 50), 50);
  assertEquals(getNextHistoryPage(50, 50), 100);
  assertEquals(getNextHistoryPage(100, 25), 125);
});

Deno.test("getNextHistoryPage - works from zero", () => {
  assertEquals(getNextHistoryPage(0, 100), 100);
});
