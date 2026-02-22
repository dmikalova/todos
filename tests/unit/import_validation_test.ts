// Unit tests for import data validation

import { assertEquals } from "@std/assert";
import { z } from "zod";

// Copy of import schemas from routes/import.ts for testing

const timeWindowSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

const projectSchema = z.object({
  id: z.string().uuid().optional(),
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
  contexts: z.array(z.string().uuid()).optional(),
  recurrence: recurrenceSchema.nullable().optional(),
});

const importDataSchema = z.object({
  version: z.string().optional(),
  projects: z.array(projectSchema).optional(),
  contexts: z.array(contextSchema).optional(),
  tasks: z.array(taskSchema).optional(),
});

// ---------------------------------------------------------------------------
// Time Window Schema Tests
// ---------------------------------------------------------------------------

Deno.test("timeWindowSchema - accepts valid time window", () => {
  const result = timeWindowSchema.parse({
    day_of_week: 1,
    start_time: "09:00",
    end_time: "17:00",
  });
  assertEquals(result.day_of_week, 1);
  assertEquals(result.start_time, "09:00");
  assertEquals(result.end_time, "17:00");
});

Deno.test("timeWindowSchema - accepts time with seconds", () => {
  const result = timeWindowSchema.parse({
    day_of_week: 0,
    start_time: "09:00:00",
    end_time: "17:30:00",
  });
  assertEquals(result.start_time, "09:00:00");
});

Deno.test("timeWindowSchema - accepts day_of_week 0 (Sunday)", () => {
  const result = timeWindowSchema.parse({
    day_of_week: 0,
    start_time: "08:00",
    end_time: "12:00",
  });
  assertEquals(result.day_of_week, 0);
});

Deno.test("timeWindowSchema - accepts day_of_week 6 (Saturday)", () => {
  const result = timeWindowSchema.parse({
    day_of_week: 6,
    start_time: "10:00",
    end_time: "14:00",
  });
  assertEquals(result.day_of_week, 6);
});

Deno.test("timeWindowSchema - rejects day_of_week 7", () => {
  const result = timeWindowSchema.safeParse({
    day_of_week: 7,
    start_time: "09:00",
    end_time: "17:00",
  });
  assertEquals(result.success, false);
});

Deno.test("timeWindowSchema - rejects invalid time format", () => {
  const result = timeWindowSchema.safeParse({
    day_of_week: 1,
    start_time: "9:00",
    end_time: "17:00",
  });
  assertEquals(result.success, false);
});

Deno.test("timeWindowSchema - rejects negative day_of_week", () => {
  const result = timeWindowSchema.safeParse({
    day_of_week: -1,
    start_time: "09:00",
    end_time: "17:00",
  });
  assertEquals(result.success, false);
});

// ---------------------------------------------------------------------------
// Project Schema Tests
// ---------------------------------------------------------------------------

Deno.test("projectSchema - accepts minimal project", () => {
  const result = projectSchema.parse({ name: "Work" });
  assertEquals(result.name, "Work");
  assertEquals(result.id, undefined);
});

Deno.test("projectSchema - accepts project with UUID", () => {
  const result = projectSchema.parse({
    id: "123e4567-e89b-12d3-a456-426614174000",
    name: "Personal",
  });
  assertEquals(result.id, "123e4567-e89b-12d3-a456-426614174000");
});

Deno.test("projectSchema - accepts project with description", () => {
  const result = projectSchema.parse({
    name: "Home",
    description: "Home improvement tasks",
  });
  assertEquals(result.description, "Home improvement tasks");
});

Deno.test("projectSchema - accepts null description", () => {
  const result = projectSchema.parse({
    name: "Test",
    description: null,
  });
  assertEquals(result.description, null);
});

Deno.test("projectSchema - rejects empty name", () => {
  const result = projectSchema.safeParse({ name: "" });
  assertEquals(result.success, false);
});

Deno.test("projectSchema - rejects name over 200 chars", () => {
  const result = projectSchema.safeParse({ name: "x".repeat(201) });
  assertEquals(result.success, false);
});

// ---------------------------------------------------------------------------
// Context Schema Tests
// ---------------------------------------------------------------------------

Deno.test("contextSchema - accepts minimal context", () => {
  const result = contextSchema.parse({ name: "Work" });
  assertEquals(result.name, "Work");
});

Deno.test("contextSchema - accepts context with time windows", () => {
  const result = contextSchema.parse({
    name: "Office",
    time_windows: [
      { day_of_week: 1, start_time: "09:00", end_time: "17:00" },
      { day_of_week: 2, start_time: "09:00", end_time: "17:00" },
    ],
  });
  assertEquals(result.time_windows?.length, 2);
});

Deno.test("contextSchema - accepts empty time_windows array", () => {
  const result = contextSchema.parse({
    name: "Anytime",
    time_windows: [],
  });
  assertEquals(result.time_windows?.length, 0);
});

Deno.test("contextSchema - rejects name over 100 chars", () => {
  const result = contextSchema.safeParse({ name: "x".repeat(101) });
  assertEquals(result.success, false);
});

// ---------------------------------------------------------------------------
// Recurrence Schema Tests
// ---------------------------------------------------------------------------

Deno.test("recurrenceSchema - accepts daily fixed recurrence", () => {
  const result = recurrenceSchema.parse({
    schedule_type: "fixed",
    frequency: "daily",
    interval: 1,
  });
  assertEquals(result.schedule_type, "fixed");
  assertEquals(result.frequency, "daily");
});

Deno.test("recurrenceSchema - accepts weekly with day_of_week", () => {
  const result = recurrenceSchema.parse({
    schedule_type: "fixed",
    frequency: "weekly",
    interval: 2,
    day_of_week: 1,
  });
  assertEquals(result.day_of_week, 1);
});

Deno.test("recurrenceSchema - accepts monthly with day_of_month", () => {
  const result = recurrenceSchema.parse({
    schedule_type: "fixed",
    frequency: "monthly",
    day_of_month: 15,
  });
  assertEquals(result.day_of_month, 15);
});

Deno.test("recurrenceSchema - accepts yearly with month_of_year", () => {
  const result = recurrenceSchema.parse({
    schedule_type: "fixed",
    frequency: "yearly",
    day_of_month: 25,
    month_of_year: 12,
  });
  assertEquals(result.month_of_year, 12);
});

Deno.test("recurrenceSchema - accepts completion-based", () => {
  const result = recurrenceSchema.parse({
    schedule_type: "completion",
    frequency: "daily",
    interval: 3,
  });
  assertEquals(result.schedule_type, "completion");
  assertEquals(result.interval, 3);
});

Deno.test("recurrenceSchema - defaults interval to 1", () => {
  const result = recurrenceSchema.parse({
    schedule_type: "fixed",
    frequency: "weekly",
  });
  assertEquals(result.interval, 1);
});

Deno.test("recurrenceSchema - rejects invalid schedule_type", () => {
  const result = recurrenceSchema.safeParse({
    schedule_type: "invalid",
    frequency: "daily",
  });
  assertEquals(result.success, false);
});

Deno.test("recurrenceSchema - rejects invalid frequency", () => {
  const result = recurrenceSchema.safeParse({
    schedule_type: "fixed",
    frequency: "hourly",
  });
  assertEquals(result.success, false);
});

Deno.test("recurrenceSchema - rejects day_of_month > 31", () => {
  const result = recurrenceSchema.safeParse({
    schedule_type: "fixed",
    frequency: "monthly",
    day_of_month: 32,
  });
  assertEquals(result.success, false);
});

Deno.test("recurrenceSchema - rejects month_of_year > 12", () => {
  const result = recurrenceSchema.safeParse({
    schedule_type: "fixed",
    frequency: "yearly",
    month_of_year: 13,
  });
  assertEquals(result.success, false);
});

// ---------------------------------------------------------------------------
// Task Schema Tests
// ---------------------------------------------------------------------------

Deno.test("taskSchema - accepts minimal task", () => {
  const result = taskSchema.parse({ title: "Buy groceries" });
  assertEquals(result.title, "Buy groceries");
});

Deno.test("taskSchema - accepts task with all fields", () => {
  const result = taskSchema.parse({
    id: "123e4567-e89b-12d3-a456-426614174000",
    title: "Complete report",
    description: "Quarterly financial report",
    due_date: "2026-02-28T17:00:00.000Z",
    project_id: "223e4567-e89b-12d3-a456-426614174001",
    contexts: ["323e4567-e89b-12d3-a456-426614174002"],
    recurrence: {
      schedule_type: "fixed",
      frequency: "weekly",
      interval: 1,
    },
  });
  assertEquals(result.title, "Complete report");
  assertEquals(result.contexts?.length, 1);
  assertEquals(result.recurrence?.frequency, "weekly");
});

Deno.test("taskSchema - accepts null recurrence", () => {
  const result = taskSchema.parse({
    title: "One-time task",
    recurrence: null,
  });
  assertEquals(result.recurrence, null);
});

Deno.test("taskSchema - rejects empty title", () => {
  const result = taskSchema.safeParse({ title: "" });
  assertEquals(result.success, false);
});

Deno.test("taskSchema - rejects title over 500 chars", () => {
  const result = taskSchema.safeParse({ title: "x".repeat(501) });
  assertEquals(result.success, false);
});

// ---------------------------------------------------------------------------
// Full Import Data Schema Tests
// ---------------------------------------------------------------------------

Deno.test("importDataSchema - accepts empty import", () => {
  const result = importDataSchema.parse({});
  assertEquals(result.projects, undefined);
  assertEquals(result.tasks, undefined);
});

Deno.test("importDataSchema - accepts version field", () => {
  const result = importDataSchema.parse({ version: "1.0.0" });
  assertEquals(result.version, "1.0.0");
});

Deno.test("importDataSchema - accepts full import data", () => {
  const result = importDataSchema.parse({
    version: "1.0.0",
    projects: [{ name: "Work" }, { name: "Personal" }],
    contexts: [
      {
        name: "Office",
        time_windows: [
          { day_of_week: 1, start_time: "09:00", end_time: "17:00" },
        ],
      },
    ],
    tasks: [
      {
        title: "Task 1",
        project_id: null,
        contexts: [],
      },
    ],
  });
  assertEquals(result.projects?.length, 2);
  assertEquals(result.contexts?.length, 1);
  assertEquals(result.tasks?.length, 1);
});

Deno.test("importDataSchema - rejects invalid project in array", () => {
  const result = importDataSchema.safeParse({
    projects: [{ name: "Valid" }, { name: "" }],
  });
  assertEquals(result.success, false);
});

Deno.test("importDataSchema - rejects invalid task in array", () => {
  const result = importDataSchema.safeParse({
    tasks: [{ title: "Valid" }, { title: "" }],
  });
  assertEquals(result.success, false);
});
