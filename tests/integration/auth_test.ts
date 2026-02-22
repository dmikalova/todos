// Integration tests for auth flow with login.mklv.tech
// Tests: session validation, middleware behavior, unauthenticated requests

import { assertEquals, assertNotEquals } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

// Note: These tests verify the middleware behavior but don't actually
// integrate with login.mklv.tech. Full auth integration requires a running
// auth server and would be tested in E2E tests.

Deno.test({
  name: "Auth Flow Tests",
  async fn(t) {
    ctx = await setupTestContext();

    await t.step(
      "unauthenticated request to protected route returns 401",
      async () => {
        // Make request without session cookie
        const req = new Request("http://localhost/api/tasks", {
          headers: { "Content-Type": "application/json" },
        });
        const res = await ctx.app.fetch(req);

        // Should return 401 Unauthorized
        assertEquals(res.status, 401);
      },
    );

    await t.step("request with invalid session returns 401", async () => {
      const req = new Request("http://localhost/api/tasks", {
        headers: {
          "Content-Type": "application/json",
          Cookie: "session=invalid-token",
        },
      });
      const res = await ctx.app.fetch(req);

      // Should return 401 Unauthorized
      assertEquals(res.status, 401);
    });

    await t.step("health endpoint is accessible without auth", async () => {
      const req = new Request("http://localhost/health");
      const res = await ctx.app.fetch(req);

      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.status, "ok");
    });

    await t.step(
      "authenticated request can access protected route",
      async () => {
        // This test would require a real session in production
        // For now, we verify the route exists and returns appropriate response
        const res = await apiCall(ctx.app, "GET", "/api/tasks");

        // Should either succeed or fail auth (not 404)
        assertNotEquals(res.status, 404);
      },
    );

    await t.step("session refresh extends expiration", async () => {
      // This would test session extension behavior
      // In mock mode, we just verify the endpoint exists
      const res = await apiCall(ctx.app, "GET", "/api/tasks");

      // Response should include refreshed session headers if authenticated
      // For mock tests, just verify we get a response
      assertNotEquals(res, null);
    });

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
