// Unit tests for middleware - validates JWT flow with mocked JWKS
// Tests: getJwtKey, validateSession, parseCookies, full auth flow with valid JWT
//
// IMPORTANT: Tests are ordered so that getJwtKey() error paths run FIRST,
// before any successful JWKS fetch caches the key (module-level singleton).

import { assertEquals, assertExists } from "@std/assert";
import { create } from "djwt";
import { Hono } from "hono";
import { _resetConfig, _setConfigForTest } from "../../src/config.ts";
import {
  authMiddleware,
  errorHandler,
  rateLimitMiddleware,
} from "../../src/middleware.ts";
import type { AppEnv } from "../../src/types.ts";

// Generate an ES256 key pair for test JWT signing
async function generateTestKeyPair(): Promise<{
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const publicJwk = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicJwk,
  };
}

// Create a signed JWT
async function createTestJwt(
  privateKey: CryptoKey,
  payload: Record<string, unknown>,
): Promise<string> {
  return await create({ alg: "ES256", typ: "JWT" }, payload, privateKey);
}

// Create a test Hono app with middleware applied
function createTestApp(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use("*", rateLimitMiddleware);
  app.use("*", authMiddleware);
  app.onError(errorHandler);
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.get("/api/test", (c) => {
    const session = c.get("session");
    return c.json({ userId: session?.userId, email: session?.email });
  });
  app.get("/page", (c) => c.text("page content"));
  return app;
}

// Helper to save/restore config and fetch stub
function setupEnv(): {
  originalFetch: typeof globalThis.fetch;
} {
  const originalFetch = globalThis.fetch;
  // Set production mode so auth middleware doesn't dev-bypass
  _setConfigForTest({ isDev: false, supabaseUrl: null });
  return { originalFetch };
}

function restoreEnv(saved: {
  originalFetch: typeof globalThis.fetch;
}): void {
  globalThis.fetch = saved.originalFetch;
  _resetConfig();
}

function stubFetch(
  handler: (url: string) => Response | Promise<Response>,
): void {
  globalThis.fetch = ((input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;
    return Promise.resolve(handler(url));
  }) as typeof globalThis.fetch;
}

// ============================================================
// JWKS ERROR TESTS - Must run BEFORE any successful key fetch
// (getJwtKey caches the key module-level for 1 hour)
// ============================================================

Deno.test({
  name: "Middleware - missing SUPABASE_URL returns 401",
  async fn() {
    const saved = setupEnv();
    stubFetch(() => new Response("should not be called", { status: 500 }));
    try {
      const app = createTestApp();
      const req = new Request("http://localhost/api/test", {
        headers: { Cookie: "session=some-token" },
      });
      const res = await app.fetch(req);
      assertEquals(res.status, 401);
    } finally {
      restoreEnv(saved);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Middleware - JWKS fetch failure returns 401",
  async fn() {
    const saved = setupEnv();
    _setConfigForTest({ isDev: false, supabaseUrl: "http://localhost:19999" });
    stubFetch(() => new Response("Server Error", { status: 500 }));
    try {
      const app = createTestApp();
      const req = new Request("http://localhost/api/test", {
        headers: { Cookie: "session=some-token" },
      });
      const res = await app.fetch(req);
      assertEquals(res.status, 401);
    } finally {
      restoreEnv(saved);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Middleware - JWKS with no keys returns 401",
  async fn() {
    const saved = setupEnv();
    _setConfigForTest({ isDev: false, supabaseUrl: "http://localhost:29999" });
    stubFetch(
      () => new Response(JSON.stringify({ keys: [] }), { status: 200 }),
    );
    try {
      const app = createTestApp();
      const req = new Request("http://localhost/api/test", {
        headers: { Cookie: "session=some-token" },
      });
      const res = await app.fetch(req);
      assertEquals(res.status, 401);
    } finally {
      restoreEnv(saved);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Middleware - JWKS with no ES256 key returns 401",
  async fn() {
    const saved = setupEnv();
    _setConfigForTest({ isDev: false, supabaseUrl: "http://localhost:39999" });
    stubFetch(
      () =>
        new Response(
          JSON.stringify({
            keys: [{ kty: "RSA", alg: "RS256", kid: "wrong", n: "x", e: "y" }],
          }),
          { status: 200 },
        ),
    );
    try {
      const app = createTestApp();
      const req = new Request("http://localhost/api/test", {
        headers: { Cookie: "session=some-token" },
      });
      const res = await app.fetch(req);
      assertEquals(res.status, 401);
    } finally {
      restoreEnv(saved);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Middleware - no session cookie on API request returns 401",
  async fn() {
    const saved = setupEnv();
    _setConfigForTest({ isDev: false, supabaseUrl: "http://localhost:49999" });
    try {
      const app = createTestApp();
      const req = new Request("http://localhost/api/test");
      const res = await app.fetch(req);
      assertEquals(res.status, 401);
    } finally {
      restoreEnv(saved);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name: "Middleware - no session cookie on browser request redirects to login",
  async fn() {
    const saved = setupEnv();
    _setConfigForTest({ isDev: false, supabaseUrl: "http://localhost:49999" });
    try {
      const app = createTestApp();
      const req = new Request("http://localhost/page");
      const res = await app.fetch(req);
      assertEquals(res.status, 302);
      const location = res.headers.get("Location") || "";
      assertEquals(location.includes("login.mklv.tech"), true);
      assertEquals(location.includes("returnUrl"), true);
    } finally {
      restoreEnv(saved);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

Deno.test({
  name:
    "Middleware - browser request without session redirects without returnUrl path only",
  async fn() {
    const saved = setupEnv();
    _setConfigForTest({ isDev: false, supabaseUrl: "http://localhost:49999" });
    try {
      const app = createTestApp();
      // Request to root "/" still includes returnUrl in redirect
      const req = new Request("http://localhost/");
      const res = await app.fetch(req);
      assertEquals(res.status, 302);
      const location = res.headers.get("Location") || "";
      assertExists(location);
      assertEquals(location.includes("login.mklv.tech"), true);
    } finally {
      restoreEnv(saved);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});

// ============================================================
// JWT VALIDATION TESTS - These run after JWKS error tests.
// The first successful JWKS fetch caches the key for all subsequent tests.
// ============================================================

Deno.test({
  name: "Middleware JWT validation with valid and invalid tokens",
  async fn(t) {
    const { privateKey, publicJwk } = await generateTestKeyPair();
    const supabaseUrl = "http://localhost:54321";
    const saved = setupEnv();
    _setConfigForTest({ isDev: false, supabaseUrl });

    // Stub fetch to return our test JWKS
    stubFetch((url) => {
      if (url.includes("/.well-known/jwks.json")) {
        return new Response(
          JSON.stringify({
            keys: [
              {
                ...publicJwk,
                kid: "test-key-1",
                alg: "ES256",
                use: "sig",
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Not Found", { status: 404 });
    });

    const app = createTestApp();

    try {
      await t.step(
        "valid JWT sets session and allows request through",
        async () => {
          const token = await createTestJwt(privateKey, {
            sub: "user-uuid-123",
            email: "test@example.com",
            aud: "authenticated",
            iss: supabaseUrl,
            exp: Math.floor(Date.now() / 1000) + 3600,
            user_metadata: {
              full_name: "Test User",
              avatar_url: "http://pic",
            },
          });

          const req = new Request("http://localhost/api/test", {
            headers: { Cookie: `session=${token}` },
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 200);
          const body = await res.json();
          assertEquals(body.userId, "user-uuid-123");
          assertEquals(body.email, "test@example.com");
        },
      );

      await t.step("expired JWT returns 401 for API requests", async () => {
        const token = await createTestJwt(privateKey, {
          sub: "user-uuid-123",
          email: "test@example.com",
          aud: "authenticated",
          iss: supabaseUrl,
          exp: Math.floor(Date.now() / 1000) - 3600, // expired
          user_metadata: {},
        });

        const req = new Request("http://localhost/api/test", {
          headers: { Cookie: `session=${token}` },
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 401);
      });

      await t.step(
        "invalid audience JWT returns 401 for API requests",
        async () => {
          const token = await createTestJwt(privateKey, {
            sub: "user-uuid-123",
            email: "test@example.com",
            aud: "wrong-audience",
            iss: supabaseUrl,
            exp: Math.floor(Date.now() / 1000) + 3600,
          });

          const req = new Request("http://localhost/api/test", {
            headers: { Cookie: `session=${token}` },
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 401);
        },
      );

      await t.step("missing sub in JWT returns 401", async () => {
        const token = await createTestJwt(privateKey, {
          // no sub
          email: "test@example.com",
          aud: "authenticated",
          iss: supabaseUrl,
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

        const req = new Request("http://localhost/api/test", {
          headers: { Cookie: `session=${token}` },
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 401);
      });

      await t.step(
        "JWT without email field uses empty string fallback",
        async () => {
          const token = await createTestJwt(privateKey, {
            sub: "user-no-email",
            // no email field
            aud: "authenticated",
            iss: supabaseUrl,
            exp: Math.floor(Date.now() / 1000) + 3600,
            user_metadata: { full_name: "No Email User" },
          });

          const req = new Request("http://localhost/api/test", {
            headers: { Cookie: `session=${token}` },
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 200);
          const body = await res.json();
          assertEquals(body.userId, "user-no-email");
          assertEquals(body.email, "");
        },
      );

      await t.step("invalid issuer JWT returns 401", async () => {
        const token = await createTestJwt(privateKey, {
          sub: "user-uuid-123",
          email: "test@example.com",
          aud: "authenticated",
          iss: "http://evil.example.com",
          exp: Math.floor(Date.now() / 1000) + 3600,
        });

        const req = new Request("http://localhost/api/test", {
          headers: { Cookie: `session=${token}` },
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 401);
      });

      await t.step("missing exp in JWT returns 401", async () => {
        const token = await createTestJwt(privateKey, {
          sub: "user-uuid-123",
          email: "test@example.com",
          aud: "authenticated",
          iss: supabaseUrl,
          // no exp
        });

        const req = new Request("http://localhost/api/test", {
          headers: { Cookie: `session=${token}` },
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 401);
      });

      await t.step("valid JWT with browser request sets session", async () => {
        const token = await createTestJwt(privateKey, {
          sub: "user-uuid-456",
          email: "browser@example.com",
          aud: "authenticated",
          iss: supabaseUrl,
          exp: Math.floor(Date.now() / 1000) + 3600,
          user_metadata: { name: "Browser User" },
        });

        const req = new Request("http://localhost/page", {
          headers: { Cookie: `session=${token}` },
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 200);
        const body = await res.text();
        assertEquals(body, "page content");
      });

      await t.step(
        "browser request with invalid session redirects to login",
        async () => {
          const req = new Request("http://localhost/page", {
            headers: { Cookie: "session=not-a-valid-jwt" },
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 302);
          const location = res.headers.get("Location") || "";
          assertEquals(location.includes("login.mklv.tech"), true);
          assertEquals(location.includes("returnUrl"), true);
        },
      );
    } finally {
      restoreEnv(saved);
    }
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
