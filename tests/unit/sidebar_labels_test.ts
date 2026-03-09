// Unit tests for sidebar label constants
// Verify all labels are lowercase and sourced from the constants file

import { assertEquals } from "@std/assert";
import { NAV_LABELS, SECTION_LABELS } from "../../src/frontend/labels.ts";

// ---------------------------------------------------------------------------
// NAV_LABELS Tests
// ---------------------------------------------------------------------------

Deno.test("NAV_LABELS - all values are lowercase", () => {
  for (const [key, value] of Object.entries(NAV_LABELS)) {
    assertEquals(
      value,
      value.toLowerCase(),
      `NAV_LABELS.${key} must be lowercase: got "${value}"`,
    );
  }
});

Deno.test("NAV_LABELS - contains all expected navigation items", () => {
  const expected = [
    "addTask",
    "search",
    "inbox",
    "next",
    "due",
    "history",
    "settings",
  ];
  assertEquals(Object.keys(NAV_LABELS).sort(), expected.sort());
});

Deno.test("NAV_LABELS - values are non-empty strings", () => {
  for (const [key, value] of Object.entries(NAV_LABELS)) {
    assertEquals(typeof value, "string", `NAV_LABELS.${key} must be a string`);
    assertEquals(value.length > 0, true, `NAV_LABELS.${key} must not be empty`);
  }
});

// ---------------------------------------------------------------------------
// SECTION_LABELS Tests
// ---------------------------------------------------------------------------

Deno.test("SECTION_LABELS - all values are lowercase", () => {
  for (const [key, value] of Object.entries(SECTION_LABELS)) {
    assertEquals(
      value,
      value.toLowerCase(),
      `SECTION_LABELS.${key} must be lowercase: got "${value}"`,
    );
  }
});

Deno.test("SECTION_LABELS - contains all expected section headers", () => {
  const expected = ["filters", "projects", "contexts"];
  assertEquals(Object.keys(SECTION_LABELS).sort(), expected.sort());
});
