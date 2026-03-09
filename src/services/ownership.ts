// Ownership validation helper for multi-user resource access control
// Returns 403 for resources owned by another user, 404 for non-existent resources

import { HTTPException } from "hono/http-exception";
import type { SqlQuery } from "../db/index.ts";

// Only these tables support ownership checks
const OWNED_TABLES = new Set([
  "projects",
  "contexts",
  "tasks",
  "saved_filters",
]);

// Singular label for error messages
const TABLE_LABELS: Record<string, string> = {
  projects: "Project",
  contexts: "Context",
  tasks: "Task",
  saved_filters: "Filter",
};

/**
 * Assert that a resource exists and belongs to the given user.
 * Throws 404 if the resource doesn't exist, 403 if it belongs to another user.
 *
 * Table name is validated against an allowlist — only server code should call this.
 */
export async function assertOwnership(
  sql: SqlQuery,
  table: string,
  id: string,
  userId: string,
): Promise<void> {
  if (!OWNED_TABLES.has(table)) {
    throw new Error(`assertOwnership: unsupported table "${table}"`);
  }

  // Each table uses a parameterized query — table name is from allowlist, not user input
  let rows: { user_id: string }[];
  switch (table) {
    case "projects":
      rows = await sql<
        { user_id: string }[]
      >`SELECT user_id FROM projects WHERE id = ${id}`;
      break;
    case "contexts":
      rows = await sql<
        { user_id: string }[]
      >`SELECT user_id FROM contexts WHERE id = ${id}`;
      break;
    case "tasks":
      rows = await sql<
        { user_id: string }[]
      >`SELECT user_id FROM tasks WHERE id = ${id}`;
      break;
    case "saved_filters":
      rows = await sql<
        { user_id: string }[]
      >`SELECT user_id FROM saved_filters WHERE id = ${id}`;
      break;
    default:
      throw new Error(`assertOwnership: unsupported table "${table}"`);
  }

  const label = TABLE_LABELS[table] ?? table;

  if (rows.length === 0) {
    throw new HTTPException(404, { message: `${label} not found` });
  }

  if (rows[0].user_id !== userId) {
    throw new HTTPException(403, { message: "Forbidden" });
  }
}
