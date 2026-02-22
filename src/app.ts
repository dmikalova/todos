// Hono Application Setup

import { Hono } from "hono";
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

// Serve favicon
app.get("/favicon.svg", async (c) => {
  try {
    const svg = await Deno.readTextFile(
      new URL("./public/favicon.svg", import.meta.url).pathname,
    );
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

// Serve compiled CSS
app.get("/output.css", async (c) => {
  try {
    const css = await Deno.readTextFile(
      new URL("./public/output.css", import.meta.url).pathname,
    );
    return new Response(css, {
      headers: { "Content-Type": "text/css" },
    });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

// Serve built frontend assets
app.get("/assets/*", async (c) => {
  const path = c.req.path;
  const distDir = new URL("./public/dist", import.meta.url).pathname;
  try {
    const file = await Deno.readFile(`${distDir}${path}`);
    const ext = path.split(".").pop();
    const contentType = ext === "js"
      ? "application/javascript"
      : ext === "css"
      ? "text/css"
      : "application/octet-stream";
    return new Response(file, {
      headers: { "Content-Type": contentType },
    });
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});

// Serve frontend
app.get("/", async (c) => {
  const distDir = new URL("./public/dist", import.meta.url).pathname;
  try {
    const html = await Deno.readTextFile(`${distDir}/index.html`);
    return c.html(html);
  } catch {
    try {
      const html = await Deno.readTextFile(
        new URL("./public/index.html", import.meta.url).pathname,
      );
      return c.html(html);
    } catch {
      return c.json({ message: "Todos API", version: "0.1.0" });
    }
  }
});

// Catch-all for SPA routing - serve index.html for any unmatched routes
app.get("*", async (c) => {
  // Skip API routes
  if (c.req.path.startsWith("/api/")) {
    return c.json({ error: "Not found" }, 404);
  }

  const distDir = new URL("./public/dist", import.meta.url).pathname;
  try {
    const html = await Deno.readTextFile(`${distDir}/index.html`);
    return c.html(html);
  } catch {
    return c.json({ error: "Not found" }, 404);
  }
});
