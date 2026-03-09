// Unit tests for context time window matching

import { assertEquals } from "@std/assert";

// Context matching types (mirrors API)
interface TimeWindow {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // HH:MM
  endTime: string; // HH:MM
}

interface Context {
  id: string;
  name: string;
  timeWindows: TimeWindow[];
}

/**
 * Check if a context is active at a given time
 * This is the same logic used in the /api/contexts/current endpoint
 */
function isContextActive(context: Context, localTime: Date): boolean {
  const dayOfWeek = localTime.getDay();
  const timeStr = localTime.toTimeString().slice(0, 5); // HH:MM

  return context.timeWindows.some((window) => {
    return (
      window.dayOfWeek === dayOfWeek &&
      window.startTime <= timeStr &&
      window.endTime > timeStr
    );
  });
}

/**
 * Get all active contexts at a given time
 */
function getActiveContexts(contexts: Context[], localTime: Date): Context[] {
  return contexts.filter((ctx) => isContextActive(ctx, localTime));
}

// ---------------------------------------------------------------------------
// Time Window Matching Tests
// ---------------------------------------------------------------------------

Deno.test("isContextActive - matches day and time within window", () => {
  const context: Context = {
    id: "work",
    name: "Work",
    timeWindows: [
      { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }, // Monday 9-5
    ],
  };

  // Monday at 10:30 AM
  const time = new Date("2026-02-23T10:30:00"); // This is Monday
  assertEquals(time.getDay(), 1); // Verify it's Monday

  const result = isContextActive(context, time);

  assertEquals(result, true);
});

Deno.test("isContextActive - rejects wrong day", () => {
  const context: Context = {
    id: "work",
    name: "Work",
    timeWindows: [
      { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }, // Monday only
    ],
  };

  // Tuesday at 10:30 AM
  const time = new Date("2026-02-24T10:30:00"); // This is Tuesday
  assertEquals(time.getDay(), 2); // Verify it's Tuesday

  const result = isContextActive(context, time);

  assertEquals(result, false);
});

Deno.test("isContextActive - rejects time before window", () => {
  const context: Context = {
    id: "work",
    name: "Work",
    timeWindows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
  };

  // Monday at 8:30 AM (before 9:00)
  const time = new Date("2026-02-23T08:30:00");

  const result = isContextActive(context, time);

  assertEquals(result, false);
});

Deno.test("isContextActive - rejects time after window", () => {
  const context: Context = {
    id: "work",
    name: "Work",
    timeWindows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
  };

  // Monday at 5:30 PM (after 17:00)
  const time = new Date("2026-02-23T17:30:00");

  const result = isContextActive(context, time);

  assertEquals(result, false);
});

Deno.test("isContextActive - matches at exact start time", () => {
  const context: Context = {
    id: "work",
    name: "Work",
    timeWindows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
  };

  // Monday at exactly 9:00 AM
  const time = new Date("2026-02-23T09:00:00");

  const result = isContextActive(context, time);

  assertEquals(result, true);
});

Deno.test(
  "isContextActive - rejects at exact end time (end is exclusive)",
  () => {
    const context: Context = {
      id: "work",
      name: "Work",
      timeWindows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
    };

    // Monday at exactly 5:00 PM
    const time = new Date("2026-02-23T17:00:00");

    const result = isContextActive(context, time);

    assertEquals(result, false);
  },
);

Deno.test("isContextActive - matches multiple windows same day", () => {
  const context: Context = {
    id: "work",
    name: "Work",
    timeWindows: [
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" }, // Morning
      { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" }, // Afternoon
    ],
  };

  // Monday at 2:30 PM (afternoon window)
  const time = new Date("2026-02-23T14:30:00");

  const result = isContextActive(context, time);

  assertEquals(result, true);
});

Deno.test("isContextActive - gap between windows not active", () => {
  const context: Context = {
    id: "work",
    name: "Work",
    timeWindows: [
      { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
      { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" },
    ],
  };

  // Monday at 12:30 PM (lunch break)
  const time = new Date("2026-02-23T12:30:00");

  const result = isContextActive(context, time);

  assertEquals(result, false);
});

// ---------------------------------------------------------------------------
// Multiple Days Tests
// ---------------------------------------------------------------------------

Deno.test("isContextActive - weekday context active Mon-Fri", () => {
  const context: Context = {
    id: "work",
    name: "Work",
    timeWindows: [
      { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }, // Monday
      { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" }, // Tuesday
      { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" }, // Wednesday
      { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" }, // Thursday
      { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" }, // Friday
    ],
  };

  // Wednesday at 2:00 PM
  const wednesday = new Date("2026-02-25T14:00:00");
  assertEquals(isContextActive(context, wednesday), true);

  // Saturday at 2:00 PM
  const saturday = new Date("2026-02-21T14:00:00");
  assertEquals(saturday.getDay(), 6); // Verify Saturday
  assertEquals(isContextActive(context, saturday), false);
});

// ---------------------------------------------------------------------------
// getActiveContexts Tests
// ---------------------------------------------------------------------------

Deno.test("getActiveContexts - returns all active contexts", () => {
  const contexts: Context[] = [
    {
      id: "work",
      name: "Work",
      timeWindows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
    },
    {
      id: "morning",
      name: "Morning",
      timeWindows: [{ dayOfWeek: 1, startTime: "06:00", endTime: "12:00" }],
    },
    {
      id: "evening",
      name: "Evening",
      timeWindows: [{ dayOfWeek: 1, startTime: "18:00", endTime: "22:00" }],
    },
  ];

  // Monday at 10:00 AM (overlaps both work and morning)
  const time = new Date("2026-02-23T10:00:00");

  const active = getActiveContexts(contexts, time);
  const ids = active.map((c) => c.id).sort();

  assertEquals(ids, ["morning", "work"]);
});

Deno.test(
  "getActiveContexts - returns empty array when no context matches",
  () => {
    const contexts: Context[] = [
      {
        id: "work",
        name: "Work",
        timeWindows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
      },
    ];

    // Sunday at 10:00 AM
    const time = new Date("2026-02-22T10:00:00");
    assertEquals(time.getDay(), 0); // Verify Sunday

    const active = getActiveContexts(contexts, time);

    assertEquals(active, []);
  },
);

Deno.test("getActiveContexts - context with no windows is never active", () => {
  const contexts: Context[] = [
    {
      id: "empty",
      name: "Empty Context",
      timeWindows: [],
    },
  ];

  const time = new Date("2026-02-23T10:00:00");

  const active = getActiveContexts(contexts, time);

  assertEquals(active, []);
});

// ---------------------------------------------------------------------------
// Multi-Day Window Tests
// ---------------------------------------------------------------------------

Deno.test(
  "isContextActive - Mon-Fri windows: true for each covered day",
  () => {
    const context: Context = {
      id: "work",
      name: "Work",
      timeWindows: [
        { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
        { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
      ],
    };

    // Week of 2026-02-23 (Mon) through 2026-03-01 (Sun)
    const monday = new Date("2026-02-23T12:00:00");
    const tuesday = new Date("2026-02-24T12:00:00");
    const wednesday = new Date("2026-02-25T12:00:00");
    const thursday = new Date("2026-02-26T12:00:00");
    const friday = new Date("2026-02-27T12:00:00");
    const saturday = new Date("2026-02-28T12:00:00");
    const sunday = new Date("2026-03-01T12:00:00");

    assertEquals(isContextActive(context, monday), true);
    assertEquals(isContextActive(context, tuesday), true);
    assertEquals(isContextActive(context, wednesday), true);
    assertEquals(isContextActive(context, thursday), true);
    assertEquals(isContextActive(context, friday), true);
    assertEquals(isContextActive(context, saturday), false);
    assertEquals(isContextActive(context, sunday), false);
  },
);

// ---------------------------------------------------------------------------
// Project Context Inheritance Tests
// ---------------------------------------------------------------------------

interface Project {
  id: string;
  name: string;
  context_id?: string | null;
  parent_project_id?: string | null;
}

/**
 * Walk parent_project_id ancestors to find nearest context_id.
 * Same logic as Store.resolveProjectContext.
 */
function resolveProjectContext(
  project: Project,
  projects: Project[],
): string | null {
  if (project.context_id) return project.context_id;
  if (!project.parent_project_id) return null;
  const parent = projects.find((p) => p.id === project.parent_project_id);
  if (!parent) return null;
  return resolveProjectContext(parent, projects);
}

Deno.test("resolveProjectContext - nearest ancestor wins (grandparent)", () => {
  const projects: Project[] = [
    { id: "grandparent", name: "GP", context_id: "ctx-gp" },
    { id: "parent", name: "P", parent_project_id: "grandparent" },
    { id: "child", name: "C", parent_project_id: "parent" },
  ];

  const child = projects.find((p) => p.id === "child")!;
  assertEquals(resolveProjectContext(child, projects), "ctx-gp");
});

Deno.test("resolveProjectContext - direct assignment beats ancestor", () => {
  const projects: Project[] = [
    { id: "parent", name: "P", context_id: "ctx-parent" },
    {
      id: "child",
      name: "C",
      context_id: "ctx-child",
      parent_project_id: "parent",
    },
  ];

  const child = projects.find((p) => p.id === "child")!;
  assertEquals(resolveProjectContext(child, projects), "ctx-child");
});

Deno.test(
  "resolveProjectContext - no ancestor has context returns null",
  () => {
    const projects: Project[] = [
      { id: "grandparent", name: "GP" },
      { id: "parent", name: "P", parent_project_id: "grandparent" },
      { id: "child", name: "C", parent_project_id: "parent" },
    ];

    const child = projects.find((p) => p.id === "child")!;
    assertEquals(resolveProjectContext(child, projects), null);
  },
);

Deno.test(
  "resolveProjectContext - middle ancestor context wins over grandparent",
  () => {
    const projects: Project[] = [
      { id: "grandparent", name: "GP", context_id: "ctx-gp" },
      {
        id: "parent",
        name: "P",
        context_id: "ctx-parent",
        parent_project_id: "grandparent",
      },
      { id: "child", name: "C", parent_project_id: "parent" },
    ];

    const child = projects.find((p) => p.id === "child")!;
    assertEquals(resolveProjectContext(child, projects), "ctx-parent");
  },
);
