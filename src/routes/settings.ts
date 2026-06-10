// Settings API - User preferences including timezone

import { Hono } from "hono";
import { z } from "zod";
import { type SqlQuery, withDb } from "../db/index.ts";
import type { AppEnv, SessionData } from "../types.ts";

export const settings = new Hono<AppEnv>();

// Types

interface UserSettings {
  timezone: string;
}

const updateSettingsSchema = z.object({
  timezone: z.string().min(1),
});

// GET /api/settings - Get user settings
settings.get("/", async (c) => {
  const session = c.get("session") as SessionData;

  const userSettings = await withDb(
    async (sql: SqlQuery) => {
      const [row] = await sql<UserSettings[]>`
        SELECT timezone FROM user_settings WHERE user_id = ${session.userId}
      `;
      return row || { timezone: "UTC" };
    },
    { userId: session.userId },
  );

  return c.json(userSettings);
});

// PUT /api/settings - Update user settings
settings.put("/", async (c) => {
  const session = c.get("session") as SessionData;
  const body = await c.req.json();
  const result = updateSettingsSchema.safeParse(body);

  if (!result.success) {
    return c.json(
      { error: "Validation error", details: result.error.issues },
      400,
    );
  }

  const { timezone } = result.data;

  const updated = await withDb(
    async (sql: SqlQuery) => {
      const [row] = await sql<UserSettings[]>`
        INSERT INTO user_settings (user_id, timezone, updated_at)
        VALUES (${session.userId}, ${timezone}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          timezone = ${timezone},
          updated_at = NOW()
        RETURNING timezone
      `;
      return row;
    },
    { userId: session.userId },
  );

  return c.json(updated);
});
