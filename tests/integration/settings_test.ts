// Integration tests for Settings API
// Tests: GET default, PUT update, PUT validation, GET after update

import { assertEquals } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Settings Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    await t.step(
      "GET /api/settings returns default when no row exists",
      async () => {
        const res = await apiCall(ctx.app, "GET", "/api/settings");
        assertEquals(res.status, 200);
        const body = await res.json();
        assertEquals(body.timezone, "UTC");
      },
    );

    await t.step("PUT /api/settings creates settings", async () => {
      const res = await apiCall(ctx.app, "PUT", "/api/settings", {
        timezone: "America/Los_Angeles",
      });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.timezone, "America/Los_Angeles");
    });

    await t.step("GET /api/settings returns saved timezone", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/settings");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.timezone, "America/Los_Angeles");
    });

    await t.step("PUT /api/settings updates existing settings", async () => {
      const res = await apiCall(ctx.app, "PUT", "/api/settings", {
        timezone: "Europe/London",
      });
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.timezone, "Europe/London");
    });

    await t.step(
      "PUT /api/settings rejects empty timezone",
      async () => {
        const res = await apiCall(ctx.app, "PUT", "/api/settings", {
          timezone: "",
        });
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Validation error");
      },
    );

    await t.step(
      "PUT /api/settings rejects missing timezone",
      async () => {
        const res = await apiCall(ctx.app, "PUT", "/api/settings", {});
        assertEquals(res.status, 400);
        const body = await res.json();
        assertEquals(body.error, "Validation error");
      },
    );

    // Clean up
    await teardownTestContext(ctx);
  },
  sanitizeResources: false,
  sanitizeOps: false,
});
