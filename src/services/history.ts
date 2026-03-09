// History logging service for task events

import { type SqlQuery, withDb } from "../db/index.ts";

export type TaskAction =
  | "created"
  | "updated"
  | "completed"
  | "uncompleted"
  | "deferred"
  | "undeferred"
  | "deleted";

export interface HistoryEntry {
  taskId: string;
  userId: string;
  action: TaskAction;
  details?: Record<string, unknown>;
}

/**
 * Log a task action to the history table.
 */
export async function logTaskAction(entry: HistoryEntry): Promise<void> {
  await withDb(async (sql: SqlQuery) => {
    await sql`
      INSERT INTO task_history (task_id, user_id, action, details)
      VALUES (${entry.taskId}, ${entry.userId}, ${entry.action}, ${
      JSON.stringify(entry.details || {})
    })
    `;
  }, { userId: entry.userId });
}

/**
 * Log a task action within an existing transaction.
 */
export async function logTaskActionTx(
  tx: SqlQuery,
  entry: HistoryEntry,
): Promise<void> {
  await tx`
    INSERT INTO task_history (task_id, user_id, action, details)
    VALUES (${entry.taskId}, ${entry.userId}, ${entry.action}, ${
    JSON.stringify(entry.details || {})
  })
  `;
}
