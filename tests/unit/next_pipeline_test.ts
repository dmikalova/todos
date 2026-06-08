// Unit tests for isWindowActive — the only client-side pipeline logic remaining
// The full next pipeline (context resolution, priority grouping, random selection)
// is now server-side. See integration tests for coverage.

import { assertEquals } from "@std/assert";

// Pure function matching store.isWindowActive
function isWindowActive(
  window: { dayOfWeek: number; startTime: string; endTime: string },
  now: Date,
): boolean {
  if (now.getDay() !== window.dayOfWeek) return false;
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${
    String(
      now.getMinutes(),
    ).padStart(2, "0")
  }`;
  return hhmm >= window.startTime && hhmm < window.endTime;
}

// ---------------------------------------------------------------------------
// isWindowActive Tests
// ---------------------------------------------------------------------------

Deno.test("isWindowActive - matches day and time", () => {
  const window = { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" };
  // Monday at 10:00
  const now = new Date("2026-02-23T10:00:00");
  assertEquals(isWindowActive(window, now), true);
});

Deno.test("isWindowActive - wrong day returns false", () => {
  const window = { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" };
  // Sunday at 10:00
  const now = new Date("2026-02-22T10:00:00");
  assertEquals(isWindowActive(window, now), false);
});

Deno.test("isWindowActive - before start returns false", () => {
  const window = { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" };
  // Monday at 08:59
  const now = new Date("2026-02-23T08:59:00");
  assertEquals(isWindowActive(window, now), false);
});

Deno.test("isWindowActive - at end time returns false (exclusive)", () => {
  const window = { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" };
  // Monday at 17:00
  const now = new Date("2026-02-23T17:00:00");
  assertEquals(isWindowActive(window, now), false);
});

Deno.test("isWindowActive - at start time returns true (inclusive)", () => {
  const window = { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" };
  // Monday at 09:00
  const now = new Date("2026-02-23T09:00:00");
  assertEquals(isWindowActive(window, now), true);
});

Deno.test("isWindowActive - just before end returns true", () => {
  const window = { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" };
  // Monday at 16:59
  const now = new Date("2026-02-23T16:59:00");
  assertEquals(isWindowActive(window, now), true);
});
