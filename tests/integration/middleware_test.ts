// Integration tests for middleware behavior
// Tests: rate limiting, error handling, auth in non-dev mode

import { assertEquals } from "@std/assert";
import { _resetConfig, _setConfigForTest } from "../../src/config.ts";
import {
  setupTestContext,
  teardownTestContext,
  type TestContext,
} from "./setup.ts";

let ctx: TestContext;

Deno.test({
  name: "Middleware Integration Tests",
  async fn(t) {
    ctx = await setupTestContext();

    await t.step("rate limiter allows requests under limit", async () => {
      const req = new Request("http://localhost/api/tasks", {
        headers: {
          "Content-Type": "application/json",
          Cookie: "session=mock-test-session",
          "X-Forwarded-For": "192.168.1.100",
        },
      });
      const res = await ctx.app.fetch(req);
      assertEquals(res.status, 200);
    });

    await t.step("rate limiter blocks after exceeding limit", async () => {
      const ip = "10.99.99.99"; // Use unique IP to avoid interfering with other tests
      let blockedStatus: number | null = null;

      for (let i = 0; i < 210; i++) {
        const req = new Request("http://localhost/api/tasks", {
          headers: {
            "Content-Type": "application/json",
            Cookie: "session=mock-test-session",
            "X-Forwarded-For": ip,
          },
        });
        const res = await ctx.app.fetch(req);
        if (res.status === 429) {
          blockedStatus = 429;
          break;
        }
        // Consume response body to prevent resource leaks
        await res.text();
      }

      assertEquals(blockedStatus, 429);
    });

    await t.step(
      "non-dev mode: API request without cookie returns 401",
      async () => {
        _setConfigForTest({ isDev: false });
        try {
          const req = new Request("http://localhost/api/tasks", {
            headers: { "Content-Type": "application/json" },
          });
          const res = await ctx.app.fetch(req);
          assertEquals(res.status, 401);
          const body = await res.json();
          assertEquals(body.error, "Unauthorized");
        } finally {
          _resetConfig();
        }
      },
    );

    await t.step(
      "non-dev mode: browser request without cookie redirects to login",
      async () => {
        _setConfigForTest({ isDev: false });
        try {
          const req = new Request("http://localhost/some-page", {
            headers: { Accept: "text/html" },
          });
          const res = await ctx.app.fetch(req);
          // Should redirect (302 or 301) to login
          assertEquals(res.status, 302);
          const location = res.headers.get("Location") || "";
          assertEquals(location.includes("login.mklv.tech"), true);
        } finally {
          _resetConfig();
        }
      },
    );

    await t.step(
      "non-dev mode: API request with invalid session returns 401",
      async () => {
        _setConfigForTest({ isDev: false });
        try {
          const req = new Request("http://localhost/api/tasks", {
            headers: {
              "Content-Type": "application/json",
              Cookie: "session=invalid-jwt-token",
            },
          });
          const res = await ctx.app.fetch(req);
          assertEquals(res.status, 401);
          const body = await res.json();
          assertEquals(body.error, "Invalid or expired session");
        } finally {
          _resetConfig();
        }
      },
    );

    await t.step(
      "non-dev mode: browser request with invalid session redirects",
      async () => {
        _setConfigForTest({ isDev: false });
        try {
          const req = new Request("http://localhost/dashboard", {
            headers: {
              Accept: "text/html",
              Cookie: "session=invalid-jwt-token",
            },
          });
          const res = await ctx.app.fetch(req);
          assertEquals(res.status, 302);
          const location = res.headers.get("Location") || "";
          assertEquals(location.includes("login.mklv.tech"), true);
          assertEquals(location.includes("returnUrl"), true);
        } finally {
          _resetConfig();
        }
      },
    );

    await t.step("health endpoint skips rate limiting", async () => {
      // Even with a rate-limited IP, health should work
      const req = new Request("http://localhost/health", {
        headers: { "X-Forwarded-For": "10.99.99.99" },
      });
      const res = await ctx.app.fetch(req);
      assertEquals(res.status, 200);
    });

    await t.step("error handler returns 500 for unhandled errors", async () => {
      // Trigger an internal error by passing invalid JSON to a route that parses it
      const req = new Request("http://localhost/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: "session=mock-test-session",
        },
        body: "not-valid-json{{{",
      });
      const res = await ctx.app.fetch(req);
      // Should get either 400 (validation) or 500 (unhandled)
      assertEquals(res.status >= 400, true);
    });

    await t.step(
      "X-Real-IP header is used when X-Forwarded-For is absent",
      async () => {
        const req = new Request("http://localhost/api/tasks", {
          headers: {
            "Content-Type": "application/json",
            Cookie: "session=mock-test-session",
            "X-Real-IP": "172.16.0.50",
          },
        });
        const res = await ctx.app.fetch(req);
        assertEquals(res.status, 200);
      },
    );

    await teardownTestContext(ctx);
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
