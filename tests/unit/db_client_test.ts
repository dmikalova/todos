// Unit tests for database client functions
// Tests: getDbConfig, resetConnection, closeConnection

import { assertEquals, assertThrows } from "@std/assert";
import { _resetConfig, _setConfigForTest } from "../../src/config.ts";
import {
  closeConnection,
  getDbConfig,
  getSchema,
  resetConnection,
} from "../../src/db/client.ts";

Deno.test("getDbConfig - returns config from app config", () => {
  _setConfigForTest({
    db: {
      url: "postgres://test:test@localhost:5432/test",
      schema: "tasks",
      max: 10,
      idleTimeout: 30,
      connectTimeout: 10,
      acquireTimeout: 30,
    },
  });
  try {
    const config = getDbConfig();
    assertEquals(config.url, "postgres://test:test@localhost:5432/test");
    assertEquals(config.schema, "tasks");
    assertEquals(config.max, 10);
    assertEquals(config.idleTimeout, 30);
    assertEquals(config.connectTimeout, 10);
    assertEquals(config.acquireTimeout, 30);
  } finally {
    _resetConfig();
  }
});

Deno.test("getDbConfig - throws when db.url is null", () => {
  _setConfigForTest({
    db: {
      url: null,
      schema: "tasks",
      max: 10,
      idleTimeout: 30,
      connectTimeout: 10,
      acquireTimeout: 30,
    },
  });
  try {
    assertThrows(
      () => getDbConfig(),
      Error,
      "DATABASE_URL_TRANSACTION environment variable is required",
    );
  } finally {
    _resetConfig();
  }
});

Deno.test("getDbConfig - respects custom config values", () => {
  _setConfigForTest({
    db: {
      url: "postgres://x:x@localhost/db",
      schema: "custom_schema",
      max: 25,
      idleTimeout: 30,
      connectTimeout: 10,
      acquireTimeout: 30,
    },
  });
  try {
    const config = getDbConfig();
    assertEquals(config.schema, "custom_schema");
    assertEquals(config.max, 25);
  } finally {
    _resetConfig();
  }
});

Deno.test("getSchema - returns default schema", () => {
  const schema = getSchema();
  assertEquals(schema, "tasks");
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
