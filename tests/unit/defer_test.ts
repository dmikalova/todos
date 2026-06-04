// Unit tests for defer date calculation service
// Tests all presets including edge cases for specific days of the week

import { assertEquals } from "@std/assert";
import { calculateDeferDate } from "../../src/services/defer.ts";

Deno.test("calculateDeferDate - later_today adds 4 hours", () => {
  const now = new Date("2026-06-03T10:00:00");
  const result = calculateDeferDate("later_today", now);
  assertEquals(result.getTime(), now.getTime() + 4 * 60 * 60 * 1000);
});

Deno.test("calculateDeferDate - tomorrow sets to next day 9am", () => {
  const now = new Date("2026-06-03T15:30:00");
  const result = calculateDeferDate("tomorrow", now);
  assertEquals(result.getDate(), 4);
  assertEquals(result.getHours(), 9);
  assertEquals(result.getMinutes(), 0);
});

Deno.test("calculateDeferDate - weekend from Wednesday defers to Saturday", () => {
  // Wednesday = day 3
  const now = new Date("2026-06-03T10:00:00"); // Wednesday
  const result = calculateDeferDate("weekend", now);
  assertEquals(result.getDay(), 6); // Saturday
  assertEquals(result.getHours(), 10);
  assertEquals(result.getDate(), 6); // June 6 is Saturday
});

Deno.test("calculateDeferDate - weekend from Friday defers to Saturday", () => {
  // Friday = day 5
  const now = new Date("2026-06-05T10:00:00"); // Friday
  const result = calculateDeferDate("weekend", now);
  assertEquals(result.getDay(), 6); // Saturday
  assertEquals(result.getDate(), 6); // Next day
});

Deno.test("calculateDeferDate - weekend from Saturday defers to next Saturday", () => {
  // Saturday = day 6 - this is the || 7 branch
  const now = new Date("2026-06-06T10:00:00"); // Saturday
  const result = calculateDeferDate("weekend", now);
  assertEquals(result.getDay(), 6); // Saturday
  assertEquals(result.getDate(), 13); // Next Saturday (7 days later)
  assertEquals(result.getHours(), 10);
});

Deno.test("calculateDeferDate - weekend from Sunday defers to next Saturday", () => {
  // Sunday = day 0
  const now = new Date("2026-06-07T10:00:00"); // Sunday
  const result = calculateDeferDate("weekend", now);
  assertEquals(result.getDay(), 6); // Saturday
  assertEquals(result.getDate(), 13); // 6 days later
});

Deno.test("calculateDeferDate - next_week from Wednesday defers to Monday", () => {
  // Wednesday = day 3
  const now = new Date("2026-06-03T10:00:00"); // Wednesday
  const result = calculateDeferDate("next_week", now);
  assertEquals(result.getDay(), 1); // Monday
  assertEquals(result.getHours(), 9);
  assertEquals(result.getDate(), 8); // June 8 is Monday
});

Deno.test("calculateDeferDate - next_week from Sunday defers to Monday", () => {
  // Sunday = day 0
  const now = new Date("2026-06-07T10:00:00"); // Sunday
  const result = calculateDeferDate("next_week", now);
  assertEquals(result.getDay(), 1); // Monday
  assertEquals(result.getDate(), 8); // Next day
});

Deno.test("calculateDeferDate - next_week from Monday defers to next Monday", () => {
  // Monday = day 1 - this is the || 7 branch
  const now = new Date("2026-06-08T10:00:00"); // Monday
  const result = calculateDeferDate("next_week", now);
  assertEquals(result.getDay(), 1); // Monday
  assertEquals(result.getDate(), 15); // Next Monday (7 days later)
  assertEquals(result.getHours(), 9);
});

Deno.test("calculateDeferDate - next_week from Saturday defers to Monday", () => {
  // Saturday = day 6
  const now = new Date("2026-06-06T10:00:00"); // Saturday
  const result = calculateDeferDate("next_week", now);
  assertEquals(result.getDay(), 1); // Monday
  assertEquals(result.getDate(), 8); // 2 days later
});
