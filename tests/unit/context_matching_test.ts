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
