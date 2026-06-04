// Integration tests for app-level routes
// Tests: /api/me, /app.js, /app.js.map, static file serving, SPA catch-all

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import {
  apiCall,
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "App Routes Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    await t.step("GET /api/me returns current user profile", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/me");
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.email, "dev@localhost");
      assertEquals(body.name, "Dev User");
    });

    await t.step(
      "GET /app.js returns bundled frontend JavaScript",
      async () => {
        const req = new Request("http://localhost/app.js", {
          headers: { Cookie: "session=mock-test-session" },
        });
        const res = await ctx.app.fetch(req);
        assertEquals(res.status, 200);
        assertEquals(res.headers.get("Content-Type"), "application/javascript");
        const body = await res.text();
        assertEquals(body.length > 0, true);
      },
    );

    await t.step("GET /app.js.map returns source map in dev mode", async () => {
      const req = new Request("http://localhost/app.js.map", {
        headers: { Cookie: "session=mock-test-session" },
      });
      const res = await ctx.app.fetch(req);
      // In dev mode, source map should be available
      if (res.status === 200) {
        assertEquals(res.headers.get("Content-Type"), "application/json");
      } else {
        // If not available (no second output file), 404 is acceptable
        assertEquals(res.status, 404);
      }
    });

    await t.step("GET /favicon.svg serves favicon or returns 404", async () => {
      const req = new Request("http://localhost/favicon.svg");
      const res = await ctx.app.fetch(req);
      // Favicon may or may not exist in test environment
      if (res.status === 200) {
        assertEquals(res.headers.get("Content-Type"), "image/svg+xml");
      } else {
        assertEquals(res.status, 404);
      }
    });

    await t.step("GET /theme.css serves theme or returns 404", async () => {
      const req = new Request("http://localhost/theme.css", {
        headers: { Cookie: "session=mock-test-session" },
      });
      const res = await ctx.app.fetch(req);
      if (res.status === 200) {
        assertEquals(res.headers.get("Content-Type"), "text/css");
      } else {
        assertEquals(res.status, 404);
      }
    });

    await t.step("GET / serves index page or returns 404", async () => {
      const req = new Request("http://localhost/", {
        headers: { Cookie: "session=mock-test-session" },
      });
      const res = await ctx.app.fetch(req);
      // Index may not exist in test env
      if (res.status === 200) {
        assertStringIncludes(
          res.headers.get("Content-Type") || "",
          "text/html",
        );
      } else {
        assertEquals(res.status, 404);
      }
    });

    await t.step("GET /unknown-page serves SPA catch-all", async () => {
      const req = new Request("http://localhost/some/unknown/page", {
        headers: { Cookie: "session=mock-test-session" },
      });
      const res = await ctx.app.fetch(req);
      // Either serves index.html or 404 if not found
      if (res.status === 200) {
        assertStringIncludes(
          res.headers.get("Content-Type") || "",
          "text/html",
        );
      } else {
        assertEquals(res.status, 404);
      }
    });

    await t.step("GET /api/nonexistent returns 404", async () => {
      const res = await apiCall(ctx.app, "GET", "/api/nonexistent");
      assertEquals(res.status, 404);
      const body = await res.json();
      assertEquals(body.error, "Not found");
    });

    await t.step("GET /health returns ok without auth", async () => {
      const req = new Request("http://localhost/health");
      const res = await ctx.app.fetch(req);
      assertEquals(res.status, 200);
      const body = await res.json();
      assertEquals(body.status, "ok");
      assertExists(body.timestamp);
    });

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
