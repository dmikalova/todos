// Unit tests for recurrence calculation logic

import { assertEquals, assertThrows } from "@std/assert";
import {
  calculateNextOccurrence,
  type RecurrenceRule,
} from "../../api/services/recurrence.ts";

// Helper to create a basic rule
function createRule(overrides: Partial<RecurrenceRule>): RecurrenceRule {
  return {
    id: "test-rule",
    task_id: "test-task",
    schedule_type: "fixed",
    frequency: "daily",
    interval: 1,
    days_of_week: null,
    day_of_month: null,
    month_of_year: null,
    days_after_completion: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Daily Recurrence Tests
// ---------------------------------------------------------------------------

Deno.test("daily recurrence - adds interval days", () => {
  const rule = createRule({ frequency: "daily", interval: 1 });
  const from = new Date("2026-02-21");
  const next = calculateNextOccurrence(rule, from);
  assertEquals(next.toISOString().split("T")[0], "2026-02-22");
});

Deno.test("daily recurrence - respects interval > 1", () => {
  const rule = createRule({ frequency: "daily", interval: 3 });
  const from = new Date("2026-02-21");
  const next = calculateNextOccurrence(rule, from);
  assertEquals(next.toISOString().split("T")[0], "2026-02-24");
});

Deno.test("daily recurrence - crosses month boundary", () => {
  const rule = createRule({ frequency: "daily", interval: 1 });
  const from = new Date("2026-02-28");
  const next = calculateNextOccurrence(rule, from);
  assertEquals(next.toISOString().split("T")[0], "2026-03-01");
});

// ---------------------------------------------------------------------------
// Weekly Recurrence Tests
// ---------------------------------------------------------------------------

Deno.test("weekly recurrence - simple week interval", () => {
  const rule = createRule({ frequency: "weekly", interval: 1 });
  const from = new Date("2026-02-21"); // Saturday
  const next = calculateNextOccurrence(rule, from);
  assertEquals(next.toISOString().split("T")[0], "2026-02-28");
});

Deno.test("weekly recurrence - biweekly", () => {
  const rule = createRule({ frequency: "weekly", interval: 2 });
  const from = new Date("2026-02-21"); // Saturday
  const next = calculateNextOccurrence(rule, from);
  assertEquals(next.toISOString().split("T")[0], "2026-03-07");
});

Deno.test("weekly recurrence - specific days of week, later this week", () => {
  // From Saturday (6), looking for next occurrence on Sun (0), Mon (1), Wed (3)
  // Should find next Sunday (day after Saturday)
  const rule = createRule({
    frequency: "weekly",
    interval: 1,
    days_of_week: [0, 1, 3], // Sun, Mon, Wed
  });
  const from = new Date("2026-02-21T12:00:00"); // Saturday at noon
  const next = calculateNextOccurrence(rule, from);
  // Next day is Sunday Feb 22
  assertEquals(next.toISOString().split("T")[0], "2026-02-22");
});

Deno.test("weekly recurrence - specific days of week, same week", () => {
  // From Monday (1), looking for Wed (3) and Fri (5)
  const rule = createRule({
    frequency: "weekly",
    interval: 1,
    days_of_week: [3, 5], // Wed, Fri
  });
  const from = new Date("2026-02-16T12:00:00"); // Monday at noon
  const next = calculateNextOccurrence(rule, from);
  // Wednesday is Feb 18
  assertEquals(next.toISOString().split("T")[0], "2026-02-18");
});

// ---------------------------------------------------------------------------
// Monthly Recurrence Tests
// ---------------------------------------------------------------------------

Deno.test("monthly recurrence - simple month interval", () => {
  const rule = createRule({ frequency: "monthly", interval: 1 });
  const from = new Date("2026-02-15T12:00:00");
  const next = calculateNextOccurrence(rule, from);
  assertEquals(next.toISOString().split("T")[0], "2026-03-15");
});

Deno.test("monthly recurrence - specific day of month", () => {
  const rule = createRule({
    frequency: "monthly",
    interval: 1,
    day_of_month: 15,
  });
  const from = new Date("2026-02-21");
  const next = calculateNextOccurrence(rule, from);
  assertEquals(next.toISOString().split("T")[0], "2026-03-15");
});

Deno.test(
  "monthly recurrence - day clamps to month length (30th in Feb)",
  () => {
    const rule = createRule({
      frequency: "monthly",
      interval: 1,
      day_of_month: 30,
    });
    // Start from Jan 30 to test clamping when moving to Feb
    const from = new Date("2026-01-30T12:00:00");
    const next = calculateNextOccurrence(rule, from);
    // February 2026 has 28 days, so 30th clamps to 28th
    assertEquals(next.toISOString().split("T")[0], "2026-02-28");
  },
);

Deno.test("monthly recurrence - day clamps in leap year Feb", () => {
  const rule = createRule({
    frequency: "monthly",
    interval: 1,
    day_of_month: 30,
  });
  // 2028 is a leap year, start from Jan 30
  const from = new Date("2028-01-30T12:00:00");
  const next = calculateNextOccurrence(rule, from);
  // February 2028 has 29 days, so 30th clamps to 29th
  assertEquals(next.toISOString().split("T")[0], "2028-02-29");
});

Deno.test("monthly recurrence - 31st in month with 30 days", () => {
  const rule = createRule({
    frequency: "monthly",
    interval: 1,
    day_of_month: 31,
  });
  const from = new Date("2026-03-31T12:00:00"); // March 31
  const next = calculateNextOccurrence(rule, from);
  // April has 30 days, so 31st clamps to 30th
  assertEquals(next.toISOString().split("T")[0], "2026-04-30");
});

// ---------------------------------------------------------------------------
// Yearly Recurrence Tests
// ---------------------------------------------------------------------------

Deno.test("yearly recurrence - simple year interval", () => {
  const rule = createRule({ frequency: "yearly", interval: 1 });
  const from = new Date("2026-02-21");
  const next = calculateNextOccurrence(rule, from);
  assertEquals(next.toISOString().split("T")[0], "2027-02-21");
});

Deno.test("yearly recurrence - specific month and day", () => {
  const rule = createRule({
    frequency: "yearly",
    interval: 1,
    month_of_year: 12,
    day_of_month: 25,
  });
  const from = new Date("2026-12-25T12:00:00");
  const next = calculateNextOccurrence(rule, from);
  assertEquals(next.toISOString().split("T")[0], "2027-12-25");
});

Deno.test("yearly recurrence - Feb 29 in non-leap year", () => {
  const rule = createRule({
    frequency: "yearly",
    interval: 1,
    month_of_year: 2,
    day_of_month: 29,
  });
  const from = new Date("2028-02-29T12:00:00"); // 2028 is leap year
  const next = calculateNextOccurrence(rule, from);
  // 2029 is not a leap year, so Feb 29 clamps to Feb 28
  assertEquals(next.toISOString().split("T")[0], "2029-02-28");
});

// ---------------------------------------------------------------------------
// Completion-Based Recurrence Tests
// ---------------------------------------------------------------------------

Deno.test("completion-based - adds days after completion", () => {
  const rule = createRule({
    schedule_type: "completion",
    frequency: null,
    days_after_completion: 3,
  });
  const completionDate = new Date("2026-02-21");
  const next = calculateNextOccurrence(rule, completionDate);
  assertEquals(next.toISOString().split("T")[0], "2026-02-24");
});

Deno.test("completion-based - 30 days after completion", () => {
  const rule = createRule({
    schedule_type: "completion",
    frequency: null,
    days_after_completion: 30,
  });
  const completionDate = new Date("2026-02-15T12:00:00");
  const next = calculateNextOccurrence(rule, completionDate);
  assertEquals(next.toISOString().split("T")[0], "2026-03-17");
});

// ---------------------------------------------------------------------------
// Error Cases
// ---------------------------------------------------------------------------

Deno.test("completion-based - throws without days_after_completion", () => {
  const rule = createRule({
    schedule_type: "completion",
    frequency: null,
    days_after_completion: null,
  });
  const completionDate = new Date("2026-02-21");
  assertThrows(
    () => calculateNextOccurrence(rule, completionDate),
    Error,
    "days_after_completion is required",
  );
});

Deno.test("fixed schedule - throws without frequency", () => {
  const rule = createRule({
    schedule_type: "fixed",
    frequency: null,
  });
  const from = new Date("2026-02-21");
  assertThrows(
    () => calculateNextOccurrence(rule, from),
    Error,
    "frequency is required",
  );
});
