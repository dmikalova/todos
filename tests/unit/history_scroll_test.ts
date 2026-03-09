// Unit tests for history infinite scroll logic
// Tests fetchMoreHistory guard conditions and hasMore computation

import { assertEquals } from "@std/assert";

interface HistoryEntry {
  task_id: string;
  task_title: string;
  action: string;
  created_at: string;
}

// Pure function: should fetchMoreHistory proceed?
function shouldFetchMore(
  historyLoading: boolean,
  historyLength: number,
  historyTotal: number,
): boolean {
  if (historyLoading) return false;
  if (historyLength >= historyTotal) return false;
  return true;
}

// Pure function: does the list have more pages?
function hasMore(historyLength: number, historyTotal: number): boolean {
  return historyLength < historyTotal;
}

// Pure function: compute next offset
function nextOffset(history: HistoryEntry[]): number {
  return history.length;
}

// Pure function: merge fetched entries
function mergeHistory(
  current: HistoryEntry[],
  fetched: HistoryEntry[],
): HistoryEntry[] {
  return [...current, ...fetched];
}

// ---------------------------------------------------------------------------
// shouldFetchMore Tests
// ---------------------------------------------------------------------------

Deno.test("history scroll - blocks fetch when already loading", () => {
  assertEquals(shouldFetchMore(true, 50, 200), false);
});

Deno.test("history scroll - blocks fetch when all entries loaded", () => {
  assertEquals(shouldFetchMore(false, 200, 200), false);
});

Deno.test("history scroll - blocks fetch when loaded exceeds total", () => {
  assertEquals(shouldFetchMore(false, 250, 200), false);
});

Deno.test("history scroll - allows fetch when more entries available", () => {
  assertEquals(shouldFetchMore(false, 100, 200), true);
});

Deno.test("history scroll - allows fetch from empty state", () => {
  assertEquals(shouldFetchMore(false, 0, 50), true);
});

// ---------------------------------------------------------------------------
// hasMore Tests
// ---------------------------------------------------------------------------

Deno.test("history scroll - hasMore true when entries remain", () => {
  assertEquals(hasMore(50, 100), true);
});

Deno.test("history scroll - hasMore false when all loaded", () => {
  assertEquals(hasMore(100, 100), false);
});

Deno.test("history scroll - hasMore false when empty total", () => {
  assertEquals(hasMore(0, 0), false);
});

// ---------------------------------------------------------------------------
// nextOffset Tests
// ---------------------------------------------------------------------------

Deno.test("history scroll - offset equals current history length", () => {
  const history: HistoryEntry[] = [
    {
      task_id: "t1",
      task_title: "A",
      action: "complete",
      created_at: "2026-01-01T00:00:00Z",
    },
    {
      task_id: "t2",
      task_title: "B",
      action: "complete",
      created_at: "2026-01-02T00:00:00Z",
    },
  ];
  assertEquals(nextOffset(history), 2);
});

Deno.test("history scroll - offset zero for empty history", () => {
  assertEquals(nextOffset([]), 0);
});

// ---------------------------------------------------------------------------
// mergeHistory Tests
// ---------------------------------------------------------------------------

Deno.test("history scroll - merges new entries after existing", () => {
  const current: HistoryEntry[] = [
    {
      task_id: "t1",
      task_title: "A",
      action: "complete",
      created_at: "2026-01-01T00:00:00Z",
    },
  ];
  const fetched: HistoryEntry[] = [
    {
      task_id: "t2",
      task_title: "B",
      action: "complete",
      created_at: "2026-01-02T00:00:00Z",
    },
  ];

  const result = mergeHistory(current, fetched);
  assertEquals(result.length, 2);
  assertEquals(result[0].task_id, "t1");
  assertEquals(result[1].task_id, "t2");
});

Deno.test("history scroll - merge with empty fetched returns current", () => {
  const current: HistoryEntry[] = [
    {
      task_id: "t1",
      task_title: "A",
      action: "complete",
      created_at: "2026-01-01T00:00:00Z",
    },
  ];

  const result = mergeHistory(current, []);
  assertEquals(result.length, 1);
});
