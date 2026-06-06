// Hono Application Setup

import * as esbuild from "esbuild";
import { type Context, Hono } from "hono";
import { serveStatic } from "hono/deno";
import { getConfig } from "./config.ts";
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
let frontendCss: string | null = null;

// Exported for testing - allows setting bundle state without running esbuild
export function _setBundleState(
  bundle: string | null,
  sourceMap: string | null,
  css?: string | null,
): void {
  frontendBundle = bundle;
  frontendSourceMap = sourceMap;
  if (css !== undefined) {
    frontendCss = css;
  }
}

export async function bundleFrontend(
  isDev = getConfig().isDev,
  entryPoint = "./src/frontend/app.ts",
): Promise<void> {
  console.log("Bundling frontend...");

  // Plugin to strip npm: prefixes and version specifiers so esbuild can resolve via node_modules
  const denoNpmPlugin: esbuild.Plugin = {
    name: "deno-npm",
    setup(build) {
      build.onResolve({ filter: /^npm:/ }, (args) => {
        // Strip npm: prefix and version specifier (e.g. npm:@m3e/web@2/button -> @m3e/web/button)
        const bare = args.path.replace(/^npm:/, "").replace(
          /^(@[^/]+\/[^@/]+|[^@/]+)@[^/]*/,
          "$1",
        );
        return build.resolve(bare, {
          kind: args.kind,
          resolveDir: args.resolveDir,
        });
      });
    },
  };

  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: "esm",
    outfile: "app.js",
    write: false,
    minify: !isDev,
    sourcemap: isDev,
    target: ["es2022"],
    plugins: [denoNpmPlugin],
    // Inline font files as data URLs to avoid serving separate woff2 files
    loader: { ".woff2": "dataurl", ".woff": "dataurl", ".ttf": "dataurl" },
    // TypeScript config for Lit decorators
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,
      },
    },
  });

  const jsFile = result.outputFiles.find((f) => f.path.endsWith(".js"))!;
  const mapFile = result.outputFiles.find((f) => f.path.endsWith(".js.map"));
  frontendBundle = new TextDecoder().decode(jsFile.contents);
  frontendSourceMap = mapFile
    ? new TextDecoder().decode(mapFile.contents)
    : null;
  const cssFile = result.outputFiles.find((f) => f.path.endsWith(".css"));
  if (cssFile) {
    frontendCss = new TextDecoder().decode(cssFile.contents);
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

// Current user profile
app.get("/api/me", (c) => {
  const session = c.get("session")!;
  return c.json({
    email: session.email,
    name: session.name,
    picture: session.picture,
  });
});

// Static file serving - check dist/ first (production build), fallback to public/

// Serve static assets from dist/ (production build)
app.use("/assets/*", serveStatic({ root: "./dist" }));

// Serve bundled frontend JS (from memory, bundled at startup)
app.get("/app.js", (_c) => {
  return new Response(frontendBundle, {
    headers: { "Content-Type": "application/javascript" },
  });
});

// Serve bundled CSS (fonts, component styles)
app.get("/app.css", (c) => {
  if (!frontendCss) {
    return c.json({ error: "No CSS bundle" }, 404);
  }
  return new Response(frontendCss, {
    headers: { "Content-Type": "text/css" },
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

// Serve Material Symbols Rounded font (self-hosted from fontsource package)
app.get("/fonts/material-symbols-rounded.woff2", async (c) => {
  try {
    const fontPath = import.meta.resolve(
      "npm:@fontsource/material-symbols-rounded/files/material-symbols-rounded-latin-400-normal.woff2",
    ).replace("file://", "");
    const font = await Deno.readFile(fontPath);
    return new Response(font, {
      headers: {
        "Content-Type": "font/woff2",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return c.json({ error: "Font not found" }, 404);
  }
});

// Live-reload SSE endpoint (dev only)
if (getConfig().isDev) {
  app.get("/api/live-reload", (c) => {
    const stream = new ReadableStream({
      start(controller) {
        // Send a heartbeat every 30s to keep connection alive
        const interval = setInterval(() => {
          controller.enqueue(new TextEncoder().encode(": heartbeat\n\n"));
        }, 30000);
        // Clean up on close
        c.req.raw.signal.addEventListener("abort", () => {
          clearInterval(interval);
        });
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  });
}

const liveReloadScript = `<script>
(function() {
  const es = new EventSource('/api/live-reload');
  es.onerror = function() {
    es.close();
    setTimeout(function retry() {
      fetch('/health').then(function() {
        location.reload();
      }).catch(function() {
        setTimeout(retry, 500);
      });
    }, 500);
  };
})();
</script>`;

// Serve frontend
async function serveIndex(c: Context): Promise<Response> {
  // Try dist first (production build), then src/public (legacy)
  for (const path of ["./dist/index.html", "./src/public/index.html"]) {
    try {
      let html = await Deno.readTextFile(path);
      if (getConfig().isDev) {
        html = html.replace("</body>", `${liveReloadScript}</body>`);
      }
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
