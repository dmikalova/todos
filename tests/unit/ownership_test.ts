// Unit tests for ownership validation service
// Tests: unsupported table, 403 forbidden path

import { assertEquals, assertRejects } from "@std/assert";
import type { SqlQuery } from "../../src/db/index.ts";
import { assertOwnership } from "../../src/services/ownership.ts";

// Mock SQL that returns rows for a specific user
function mockSql(rows: { user_id: string }[]): SqlQuery {
  const fn = () => Promise.resolve(rows);
  fn.json = (value: unknown) => value;
  return fn as unknown as SqlQuery;
}

Deno.test("assertOwnership - throws Error for unsupported table", async () => {
  const sql = mockSql([]);
  await assertRejects(
    () => assertOwnership(sql, "unknown_table", "some-id", "some-user"),
    Error,
    'assertOwnership: unsupported table "unknown_table"',
  );
});

Deno.test(
  "assertOwnership - throws 404 for non-existent resource",
  async () => {
    const sql = mockSql([]);
    try {
      await assertOwnership(sql, "projects", "non-existent-id", "user-1");
      throw new Error("Should have thrown");
    } catch (e: unknown) {
      const err = e as { status: number; message: string };
      assertEquals(err.status, 404);
    }
  },
);

Deno.test(
  "assertOwnership - throws 403 when resource belongs to another user",
  async () => {
    const sql = mockSql([{ user_id: "other-user-id" }]);
    try {
      await assertOwnership(
        sql,
        "projects",
        "project-id",
        "requesting-user-id",
      );
      throw new Error("Should have thrown");
    } catch (e: unknown) {
      const err = e as { status: number; message: string };
      assertEquals(err.status, 403);
    }
  },
);

Deno.test(
  "assertOwnership - succeeds when resource belongs to requesting user",
  async () => {
    const sql = mockSql([{ user_id: "user-1" }]);
    // Should not throw
    await assertOwnership(sql, "projects", "project-id", "user-1");
  },
);

Deno.test("assertOwnership - works for contexts table", async () => {
  const sql = mockSql([{ user_id: "other-user" }]);
  try {
    await assertOwnership(sql, "contexts", "context-id", "requesting-user");
    throw new Error("Should have thrown");
  } catch (e: unknown) {
    const err = e as { status: number; message: string };
    assertEquals(err.status, 403);
  }
});
