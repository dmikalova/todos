// Authentication middleware - validates Supabase JWT from session cookie

import { verify } from "djwt";
import { type Context, type MiddlewareHandler } from "hono";
import type { AppEnv, SessionData } from "./types.ts";

function getSessionDomain(): string {
  return Deno.env.get("SESSION_DOMAIN") || "mklv.tech";
}

function getLoginUrl(returnUrl?: string): string {
  const loginBase = `https://login.${getSessionDomain()}`;
  if (returnUrl) {
    return `${loginBase}?returnUrl=${encodeURIComponent(returnUrl)}`;
  }
  return loginBase;
}

// Cached CryptoKey for JWT verification
let jwtKey: CryptoKey | null = null;
let jwtKeyFetchedAt: number = 0;
const KEY_CACHE_TTL = 3600 * 1000; // 1 hour cache

interface JWK {
  kty: string;
  crv: string;
  x: string;
  y: string;
  kid: string;
  alg: string;
}

async function getJwtKey(): Promise<CryptoKey> {
  const now = Date.now();

  if (jwtKey && now - jwtKeyFetchedAt < KEY_CACHE_TTL) {
    return jwtKey;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    throw new Error("SUPABASE_URL environment variable is required");
  }

  const jwksUrl = `${
    supabaseUrl.replace(
      /\/$/,
      "",
    )
  }/auth/v1/.well-known/jwks.json`;
  const response = await fetch(jwksUrl);

  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  const jwks = (await response.json()) as { keys: JWK[] };

  if (!jwks.keys || jwks.keys.length === 0) {
    throw new Error("No keys found in JWKS");
  }

  const jwk = jwks.keys.find((k: JWK) => k.alg === "ES256");
  if (!jwk) {
    throw new Error("No ES256 key found in JWKS");
  }

  jwtKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );

  jwtKeyFetchedAt = now;
  console.log("JWT key fetched from JWKS");

  return jwtKey;
}

async function validateSession(token: string): Promise<SessionData | null> {
  try {
    const key = await getJwtKey();
    const payload = await verify(token, key);

    if (payload.aud !== "authenticated") {
      console.warn("JWT validation failed: invalid audience");
      return null;
    }

    const expectedIssuer = Deno.env.get("SUPABASE_URL");
    if (expectedIssuer) {
      const issuerBase = expectedIssuer.replace(/\/$/, "");
      const payloadIssuer = (payload.iss as string)?.replace(/\/$/, "");
      if (payloadIssuer && !payloadIssuer.startsWith(issuerBase)) {
        console.warn("JWT validation failed: invalid issuer");
        return null;
      }
    }

    const exp = payload.exp as number;
    if (!exp) {
      console.warn("JWT validation failed: missing expiration");
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const clockSkewTolerance = 60;
    if (exp + clockSkewTolerance < now) {
      console.warn("JWT validation failed: token expired");
      return null;
    }

    const sub = payload.sub as string;
    const email = payload.email as string;

    if (!sub) {
      console.warn("JWT validation failed: missing subject");
      return null;
    }

    return {
      userId: sub,
      email: email || "",
      expiresAt: new Date(exp * 1000),
    };
  } catch (error) {
    console.warn("JWT validation error:", error);
    return null;
  }
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};

  const cookies: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key) {
      cookies[key] = valueParts.join("=");
    }
  }
  return cookies;
}

// Auth middleware - validates session and sets context
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  // Allow health check without auth
  if (c.req.path === "/health") {
    c.set("session", null);
    return next();
  }

  // Dev bypass - skip auth in development mode
  if (Deno.env.get("DENO_ENV") === "development") {
    c.set("session", {
      userId: "dev-user-id",
      email: "dev@localhost",
      expiresAt: new Date(Date.now() + 86400000), // 24 hours
    });
    return next();
  }

  const cookieHeader = c.req.header("cookie");
  const cookies = parseCookies(cookieHeader ?? null);

  // Look for session token in cookie
  const sessionToken = cookies["sb-access-token"];

  if (!sessionToken) {
    // Check if this is an API request
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    // Redirect browser requests to login
    const returnUrl = `https://todos.${getSessionDomain()}${c.req.path}`;
    return c.redirect(getLoginUrl(returnUrl));
  }

  const session = await validateSession(sessionToken);

  if (!session) {
    if (c.req.path.startsWith("/api/")) {
      return c.json({ error: "Invalid or expired session" }, 401);
    }
    const returnUrl = `https://todos.${getSessionDomain()}${c.req.path}`;
    return c.redirect(getLoginUrl(returnUrl));
  }

  c.set("session", session);
  return next();
};

// Error handling middleware
export const errorHandler = (err: Error, c: Context): Response => {
  console.error("Unhandled error:", err);

  // Don't expose internal errors in production
  const isDev = Deno.env.get("DENO_ENV") === "development";

  return c.json(
    {
      error: "Internal server error",
      ...(isDev && { message: err.message, stack: err.stack }),
    },
    500,
  );
};

// Rate limiting middleware (simple in-memory)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100; // requests per window
const RATE_WINDOW = 60 * 1000; // 1 minute

export const rateLimitMiddleware: MiddlewareHandler<AppEnv> = async (
  c,
  next,
) => {
  // Skip rate limiting for health checks
  if (c.req.path === "/health") {
    await next();
    return;
  }

  const ip = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";

  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
  } else {
    record.count++;
    if (record.count > RATE_LIMIT) {
      return c.json({ error: "Too many requests" }, 429);
    }
  }

  await next();
};
