// Hono Application Setup

import * as esbuild from "esbuild";
import { type Context, Hono } from "hono";
import { serveStatic } from "hono/deno";
import {
  authMiddleware,
  errorHandler,
  rateLimitMiddleware,
} from "./middleware.ts";
import { contexts } from "./routes/contexts.ts";
import { exportRoutes } from "./routes/export.ts";
import { filters } from "./routes/filters.ts";
import { history } from "./routes/history.ts";
import { importRoutes } from "./routes/import.ts";
import { next } from "./routes/next.ts";
import { projects } from "./routes/projects.ts";
import { recurrence } from "./routes/recurrence.ts";
import { tasks } from "./routes/tasks.ts";
import type { AppEnv } from "./types.ts";

// Bundle frontend at startup (cached in memory)
let frontendBundle: string | null = null;
let frontendSourceMap: string | null = null;

async function bundleFrontend(): Promise<void> {
  const isDev = Deno.env.get("DENO_ENV") === "development";
  console.log("Bundling frontend...");

  const result = await esbuild.build({
    entryPoints: ["./src/frontend/app.ts"],
    bundle: true,
    format: "esm",
    write: false,
    minify: !isDev,
    sourcemap: isDev,
    target: ["es2022"],
    // TypeScript config for Lit decorators
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  });

  frontendBundle = new TextDecoder().decode(result.outputFiles[0].contents);
  if (isDev && result.outputFiles[1]) {
    frontendSourceMap = new TextDecoder().decode(
      result.outputFiles[1].contents,
    );
  }

  console.log(
    `Frontend bundled: ${Math.round(frontendBundle.length / 1024)}KB`,
  );
  await esbuild.stop();
}

// Bundle on module load
await bundleFrontend();

export const app = new Hono<AppEnv>();

// Apply global middleware
app.use("*", rateLimitMiddleware);
app.use("*", authMiddleware);

// Error handler
app.onError(errorHandler);

// Health check endpoint (no auth required - handled in middleware)
app.get("/health", (c) => {
  return c.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.route("/api/tasks", tasks);
app.route("/api/recurrence", recurrence);
app.route("/api/contexts", contexts);
app.route("/api/projects", projects);
app.route("/api/filters", filters);
app.route("/api/history", history);
app.route("/api/next", next);
app.route("/api/export", exportRoutes);
app.route("/api/import", importRoutes);

// Static file serving - check dist/ first (production build), fallback to public/

// Serve static assets from dist/ (production build)
app.use("/assets/*", serveStatic({ root: "./dist" }));

// Serve bundled frontend JS (from memory, bundled at startup)
app.get("/app.js", (c) => {
  if (!frontendBundle) {
    return c.json({ error: "Frontend not bundled" }, 500);
  }
  return new Response(frontendBundle, {
    headers: { "Content-Type": "application/javascript" },
  });
});

// Serve source map for debugging (from memory)
app.get("/app.js.map", (c) => {
  if (!frontendSourceMap) {
    return c.json({ error: "Source map not available" }, 404);
  }
  return new Response(frontendSourceMap, {
    headers: { "Content-Type": "application/json" },
  });
});

// Serve favicon
app.get("/favicon.svg", async (c) => {
  // Try dist first, then public
  for (const dir of ["./dist", "./src/public"]) {
    try {
      const svg = await Deno.readTextFile(`${dir}/favicon.svg`);
      return new Response(svg, {
        headers: { "Content-Type": "image/svg+xml" },
      });
    } catch {
      continue;
    }
  }
  return c.json({ error: "Not found" }, 404);
});

// Serve theme CSS (Material 3 tokens)
app.get("/theme.css", async (c) => {
  // Try dist first, then public
  for (const dir of ["./dist", "./src/public"]) {
    try {
      const css = await Deno.readTextFile(`${dir}/theme.css`);
      return new Response(css, {
        headers: { "Content-Type": "text/css" },
      });
    } catch {
      continue;
    }
  }
  return c.json({ error: "Not found" }, 404);
});

// Serve frontend
async function serveIndex(
  c: Context,
): Promise<Response> {
  // Try dist first (production build), then src/public (legacy)
  for (const path of ["./dist/index.html", "./src/public/index.html"]) {
    try {
      const html = await Deno.readTextFile(path);
      return c.html(html);
    } catch {
      continue;
    }
  }
  return c.json({ error: "Not found" }, 404);
}

app.get("/", (c) => serveIndex(c));

// Catch-all for SPA routing - serve index.html for any unmatched routes
app.get("*", (c) => {
  // Skip API routes
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }
  return serveIndex(c);
});
