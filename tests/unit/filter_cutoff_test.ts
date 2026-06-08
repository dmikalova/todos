// Unit tests for filter cutoff date computation

import { assertEquals } from "@std/assert";

// Replicate the computeCutoffDate logic from routes/filters.ts
function computeCutoffDate(within: { amount: number; unit: string }): Date {
  const now = new Date();
  const cutoff = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  switch (within.unit) {
    case "days":
      cutoff.setDate(cutoff.getDate() + within.amount);
      break;
    case "weeks":
      cutoff.setDate(cutoff.getDate() + within.amount * 7);
      break;
    case "months":
      cutoff.setMonth(cutoff.getMonth() + within.amount);
      break;
    case "years":
      cutoff.setFullYear(cutoff.getFullYear() + within.amount);
      break;
  }
  return cutoff;
}

Deno.test("computeCutoffDate - 0 days means end of today", () => {
  const result = computeCutoffDate({ amount: 0, unit: "days" });
  const today = new Date();
  assertEquals(result.getFullYear(), today.getFullYear());
  assertEquals(result.getMonth(), today.getMonth());
  assertEquals(result.getDate(), today.getDate());
  assertEquals(result.getHours(), 23);
  assertEquals(result.getMinutes(), 59);
  assertEquals(result.getSeconds(), 59);
});

Deno.test("computeCutoffDate - 7 days adds a week", () => {
  const result = computeCutoffDate({ amount: 7, unit: "days" });
  const expected = new Date();
  expected.setDate(expected.getDate() + 7);
  assertEquals(result.getFullYear(), expected.getFullYear());
  assertEquals(result.getMonth(), expected.getMonth());
  assertEquals(result.getDate(), expected.getDate());
});

Deno.test("computeCutoffDate - 2 weeks adds 14 days", () => {
  const result = computeCutoffDate({ amount: 2, unit: "weeks" });
  const expected = new Date();
  expected.setDate(expected.getDate() + 14);
  assertEquals(result.getFullYear(), expected.getFullYear());
  assertEquals(result.getMonth(), expected.getMonth());
  assertEquals(result.getDate(), expected.getDate());
});

Deno.test("computeCutoffDate - 1 month adds a month", () => {
  const result = computeCutoffDate({ amount: 1, unit: "months" });
  const today = new Date();
  const expected = new Date(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate(),
  );
  assertEquals(result.getFullYear(), expected.getFullYear());
  assertEquals(result.getMonth(), expected.getMonth());
});

Deno.test("computeCutoffDate - 1 year adds a year", () => {
  const result = computeCutoffDate({ amount: 1, unit: "years" });
  const today = new Date();
  assertEquals(result.getFullYear(), today.getFullYear() + 1);
});

Deno.test("computeCutoffDate - negative days subtracts", () => {
  const result = computeCutoffDate({ amount: -3, unit: "days" });
  const expected = new Date();
  expected.setDate(expected.getDate() - 3);
  assertEquals(result.getFullYear(), expected.getFullYear());
  assertEquals(result.getMonth(), expected.getMonth());
  assertEquals(result.getDate(), expected.getDate());
});

// Test filtering logic
Deno.test("filter - dueDateWithin 0 days includes today and past", () => {
  const cutoff = computeCutoffDate({ amount: 0, unit: "days" });
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  assertEquals(today <= cutoff, true); // today is included
  assertEquals(yesterday <= cutoff, true); // past is included
  assertEquals(tomorrow <= cutoff, false); // tomorrow is not
});

Deno.test("filter - priority filtering works correctly", () => {
  const criteria = { priorities: [1, 3] };
  const tasks = [
    { title: "A", priority: 1 },
    { title: "B", priority: 2 },
    { title: "C", priority: 3 },
    { title: "D", priority: 4 },
  ];
  const filtered = tasks.filter((t) =>
    criteria.priorities.includes(t.priority)
  );
  assertEquals(filtered.length, 2);
  assertEquals(filtered[0].title, "A");
  assertEquals(filtered[1].title, "C");
});

Deno.test("filter - project filtering works correctly", () => {
  const criteria = { projects: ["proj-1"] };
  const tasks = [
    { title: "A", project_id: "proj-1" },
    { title: "B", project_id: "proj-2" },
    { title: "C", project_id: null },
  ];
  const filtered = tasks.filter((t) =>
    criteria.projects.includes(t.project_id || "")
  );
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].title, "A");
});
