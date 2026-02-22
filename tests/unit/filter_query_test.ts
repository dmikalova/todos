// Unit tests for filter and list tasks schema validation

import { assertEquals } from "@std/assert";
import { z } from "zod";

// Copy of the listTasksSchema from routes/tasks.ts for testing
const listTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  contextId: z.string().uuid().optional(),
  completed: z.enum(["true", "false"]).optional(),
  deleted: z.enum(["true", "false"]).optional(),
  dueBefore: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dueAfter: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Copy of filterCriteriaSchema from routes/filters.ts for testing
const filterCriteriaSchema = z.object({
  projectIds: z.array(z.string().uuid()).optional(),
  contextIds: z.array(z.string().uuid()).optional(),
  tags: z.array(z.string()).optional(),
  completed: z.boolean().optional(),
  overdue: z.boolean().optional(),
  dueBefore: z.string().datetime().optional(),
  dueAfter: z.string().datetime().optional(),
  hasRecurrence: z.boolean().optional(),
  mustDo: z.boolean().optional(),
  priorities: z.array(z.number().int().min(1).max(4)).optional(),
});

// ---------------------------------------------------------------------------
// List Tasks Schema Tests
// ---------------------------------------------------------------------------

Deno.test("listTasksSchema - accepts empty params with defaults", () => {
  const result = listTasksSchema.parse({});
  assertEquals(result.limit, 50);
  assertEquals(result.offset, 0);
  assertEquals(result.projectId, undefined);
  assertEquals(result.contextId, undefined);
});

Deno.test("listTasksSchema - accepts valid UUID projectId", () => {
  const result = listTasksSchema.parse({
    projectId: "123e4567-e89b-12d3-a456-426614174000",
  });
  assertEquals(result.projectId, "123e4567-e89b-12d3-a456-426614174000");
});

Deno.test("listTasksSchema - rejects invalid UUID projectId", () => {
  const result = listTasksSchema.safeParse({
    projectId: "not-a-uuid",
  });
  assertEquals(result.success, false);
});

Deno.test("listTasksSchema - accepts completed=true", () => {
  const result = listTasksSchema.parse({ completed: "true" });
  assertEquals(result.completed, "true");
});

Deno.test("listTasksSchema - accepts completed=false", () => {
  const result = listTasksSchema.parse({ completed: "false" });
  assertEquals(result.completed, "false");
});

Deno.test("listTasksSchema - rejects invalid completed value", () => {
  const result = listTasksSchema.safeParse({ completed: "maybe" });
  assertEquals(result.success, false);
});

Deno.test("listTasksSchema - accepts valid date for dueBefore", () => {
  const result = listTasksSchema.parse({ dueBefore: "2026-02-21" });
  assertEquals(result.dueBefore, "2026-02-21");
});

Deno.test("listTasksSchema - rejects invalid date format for dueBefore", () => {
  const result = listTasksSchema.safeParse({ dueBefore: "02-21-2026" });
  assertEquals(result.success, false);
});

Deno.test("listTasksSchema - rejects invalid date format with time", () => {
  const result = listTasksSchema.safeParse({
    dueBefore: "2026-02-21T10:00:00",
  });
  assertEquals(result.success, false);
});

Deno.test("listTasksSchema - coerces limit from string", () => {
  const result = listTasksSchema.parse({ limit: "25" });
  assertEquals(result.limit, 25);
});

Deno.test("listTasksSchema - clamps limit to max 100", () => {
  const result = listTasksSchema.safeParse({ limit: "200" });
  assertEquals(result.success, false);
});

Deno.test("listTasksSchema - rejects negative limit", () => {
  const result = listTasksSchema.safeParse({ limit: "-10" });
  assertEquals(result.success, false);
});

Deno.test("listTasksSchema - accepts offset", () => {
  const result = listTasksSchema.parse({ offset: "100" });
  assertEquals(result.offset, 100);
});

Deno.test("listTasksSchema - rejects negative offset", () => {
  const result = listTasksSchema.safeParse({ offset: "-5" });
  assertEquals(result.success, false);
});

// ---------------------------------------------------------------------------
// Filter Criteria Schema Tests
// ---------------------------------------------------------------------------

Deno.test("filterCriteriaSchema - accepts empty criteria", () => {
  const result = filterCriteriaSchema.parse({});
  assertEquals(Object.keys(result).length, 0);
});

Deno.test("filterCriteriaSchema - accepts projectIds array", () => {
  const result = filterCriteriaSchema.parse({
    projectIds: ["123e4567-e89b-12d3-a456-426614174000"],
  });
  assertEquals(result.projectIds?.length, 1);
});

Deno.test("filterCriteriaSchema - accepts multiple contextIds", () => {
  const result = filterCriteriaSchema.parse({
    contextIds: [
      "123e4567-e89b-12d3-a456-426614174000",
      "223e4567-e89b-12d3-a456-426614174001",
    ],
  });
  assertEquals(result.contextIds?.length, 2);
});

Deno.test("filterCriteriaSchema - accepts boolean completed", () => {
  const result = filterCriteriaSchema.parse({ completed: true });
  assertEquals(result.completed, true);
});

Deno.test("filterCriteriaSchema - accepts overdue filter", () => {
  const result = filterCriteriaSchema.parse({ overdue: true });
  assertEquals(result.overdue, true);
});

Deno.test("filterCriteriaSchema - accepts hasRecurrence filter", () => {
  const result = filterCriteriaSchema.parse({ hasRecurrence: false });
  assertEquals(result.hasRecurrence, false);
});

Deno.test("filterCriteriaSchema - accepts mustDo filter", () => {
  const result = filterCriteriaSchema.parse({ mustDo: true });
  assertEquals(result.mustDo, true);
});

Deno.test("filterCriteriaSchema - accepts priorities array", () => {
  const result = filterCriteriaSchema.parse({ priorities: [1, 2, 4] });
  assertEquals(result.priorities, [1, 2, 4]);
});

Deno.test("filterCriteriaSchema - rejects invalid priority value", () => {
  const result = filterCriteriaSchema.safeParse({ priorities: [0] });
  assertEquals(result.success, false);
});

Deno.test("filterCriteriaSchema - rejects priority > 4", () => {
  const result = filterCriteriaSchema.safeParse({ priorities: [5] });
  assertEquals(result.success, false);
});

Deno.test("filterCriteriaSchema - accepts ISO datetime for dueBefore", () => {
  const result = filterCriteriaSchema.parse({
    dueBefore: "2026-02-21T10:00:00.000Z",
  });
  assertEquals(result.dueBefore, "2026-02-21T10:00:00.000Z");
});

Deno.test("filterCriteriaSchema - accepts tags array", () => {
  const result = filterCriteriaSchema.parse({
    tags: ["urgent", "work"],
  });
  assertEquals(result.tags, ["urgent", "work"]);
});

Deno.test("filterCriteriaSchema - accepts combined filters", () => {
  const result = filterCriteriaSchema.parse({
    projectIds: ["123e4567-e89b-12d3-a456-426614174000"],
    completed: false,
    mustDo: true,
    priorities: [1, 2],
  });
  assertEquals(result.completed, false);
  assertEquals(result.mustDo, true);
  assertEquals(result.priorities, [1, 2]);
  assertEquals(result.projectIds?.length, 1);
});
