// Unit tests for database client functions
// Tests: getConfig, resetConnection, closeConnection

import { assertEquals, assertThrows } from "@std/assert";
import {
  closeConnection,
  getConfig,
  getSchema,
  resetConnection,
} from "../../src/db/client.ts";

Deno.test("getConfig - returns config from environment variables", () => {
  const original = Deno.env.get("DATABASE_URL_TRANSACTION");
  Deno.env.set(
    "DATABASE_URL_TRANSACTION",
    "postgres://test:test@localhost:5432/test",
  );
  try {
    const config = getConfig();
    assertEquals(config.url, "postgres://test:test@localhost:5432/test");
    assertEquals(config.schema, "todos");
    assertEquals(config.max, 10);
    assertEquals(config.idleTimeout, 30);
    assertEquals(config.connectTimeout, 10);
    assertEquals(config.acquireTimeout, 30);
  } finally {
    if (original) Deno.env.set("DATABASE_URL_TRANSACTION", original);
    else Deno.env.delete("DATABASE_URL_TRANSACTION");
  }
});

Deno.test("getConfig - throws when DATABASE_URL_TRANSACTION is missing", () => {
  const original = Deno.env.get("DATABASE_URL_TRANSACTION");
  Deno.env.delete("DATABASE_URL_TRANSACTION");
  try {
    assertThrows(
      () => getConfig(),
      Error,
      "DATABASE_URL_TRANSACTION environment variable is required",
    );
  } finally {
    if (original) Deno.env.set("DATABASE_URL_TRANSACTION", original);
  }
});

Deno.test("getConfig - respects custom env values", () => {
  const original = Deno.env.get("DATABASE_URL_TRANSACTION");
  const originalSchema = Deno.env.get("DATABASE_SCHEMA");
  const originalMax = Deno.env.get("DATABASE_POOL_MAX");

  Deno.env.set("DATABASE_URL_TRANSACTION", "postgres://x:x@localhost/db");
  Deno.env.set("DATABASE_SCHEMA", "custom_schema");
  Deno.env.set("DATABASE_POOL_MAX", "25");
  try {
    const config = getConfig();
    assertEquals(config.schema, "custom_schema");
    assertEquals(config.max, 25);
  } finally {
    if (original) Deno.env.set("DATABASE_URL_TRANSACTION", original);
    else Deno.env.delete("DATABASE_URL_TRANSACTION");
    if (originalSchema) Deno.env.set("DATABASE_SCHEMA", originalSchema);
    else Deno.env.delete("DATABASE_SCHEMA");
    if (originalMax) Deno.env.set("DATABASE_POOL_MAX", originalMax);
    else Deno.env.delete("DATABASE_POOL_MAX");
  }
});

Deno.test("getSchema - returns default schema", () => {
  const schema = getSchema();
  assertEquals(schema, "todos");
});

Deno.test("resetConnection - handles no active connection gracefully", () => {
  // Should not throw even when there's no connection
  resetConnection();
});

Deno.test(
  "closeConnection - handles no active connection gracefully",
  async () => {
    // Should not throw even when there's no connection
    await closeConnection();
  },
);
