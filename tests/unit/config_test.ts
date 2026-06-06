// Unit tests for config module

import { assertEquals, assertThrows } from "@std/assert";
import {
  _resetConfig,
  _setConfigForTest,
  getConfig,
  loadSecrets,
} from "../../src/config.ts";

Deno.test("getConfig - returns dev defaults when DENO_ENV is not production", () => {
  _resetConfig();
  const config = getConfig();
  assertEquals(config.isDev, true);
  assertEquals(config.port, 8000);
  assertEquals(config.sessionDomain, "mklv.tech");
  assertEquals(config.db.schema, "todos");
  assertEquals(config.db.max, 10);
  // DB URL defaults to dev URL when isDev is true
  assertEquals(config.db.url?.includes("localhost:5432"), true);
  _resetConfig();
});

Deno.test("_setConfigForTest - overrides specific fields", () => {
  _setConfigForTest({ isDev: false, supabaseUrl: "http://test.example.com" });
  const config = getConfig();
  assertEquals(config.isDev, false);
  assertEquals(config.supabaseUrl, "http://test.example.com");
  // Non-overridden fields keep defaults
  assertEquals(config.sessionDomain, "mklv.tech");
  _resetConfig();
});

Deno.test("_setConfigForTest - overrides nested db fields", () => {
  _setConfigForTest({
    db: {
      url: null,
      schema: "test",
      max: 5,
      idleTimeout: 10,
      connectTimeout: 5,
      acquireTimeout: 15,
    },
  });
  const config = getConfig();
  assertEquals(config.db.url, null);
  assertEquals(config.db.schema, "test");
  assertEquals(config.db.max, 5);
  _resetConfig();
});

Deno.test("_resetConfig - reloads from environment", () => {
  _setConfigForTest({ isDev: false, port: 9999 });
  assertEquals(getConfig().port, 9999);
  _resetConfig();
  // After reset, should reload from env (port defaults to 8000)
  assertEquals(getConfig().port, 8000);
});

Deno.test("getConfig - production mode sets isDev false and db.url null without DATABASE_URL_TRANSACTION", () => {
  const origDeno = Deno.env.get("DENO_ENV");
  const origDb = Deno.env.get("DATABASE_URL_TRANSACTION");
  Deno.env.set("DENO_ENV", "production");
  Deno.env.delete("DATABASE_URL_TRANSACTION");
  _resetConfig();
  try {
    const config = getConfig();
    assertEquals(config.isDev, false);
    assertEquals(config.db.url, null);
  } finally {
    if (origDeno) Deno.env.set("DENO_ENV", origDeno);
    else Deno.env.delete("DENO_ENV");
    if (origDb) Deno.env.set("DATABASE_URL_TRANSACTION", origDb);
    _resetConfig();
  }
});

Deno.test("loadSecrets - returns empty map when file not found", () => {
  const secrets = loadSecrets("/nonexistent/path.json");
  assertEquals(secrets, {});
});

Deno.test("loadSecrets - rethrows non-NotFound errors", () => {
  assertThrows(() => loadSecrets("/"), Error);
});
