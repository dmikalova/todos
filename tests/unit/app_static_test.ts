// Unit tests for app static file fallback paths
// Tests the 404 responses when static files don't exist

import { assertEquals } from "@std/assert";
import { stub } from "@std/testing/mock";
import { FakeTime } from "@std/testing/time";
import { _setBundleState, app, bundleFrontend } from "../../src/app.ts";

Deno.test({
  name: "App static file fallback tests",
  async fn(t) {
    await t.step(
      "GET /favicon.svg returns 404 when file doesn't exist anywhere",
      async () => {
        const readTextFileStub = stub(
          Deno,
          "readTextFile",
          (_path: string | URL) => {
            throw new Deno.errors.NotFound("File not found");
          },
        );
        try {
          const req = new Request("http://localhost/favicon.svg", {
            headers: { Cookie: "session=mock" },
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 404);
          const body = await res.json();
          assertEquals(body.error, "Not found");
        } finally {
          readTextFileStub.restore();
        }
      },
    );

    await t.step(
      "GET /theme.css returns 404 when file doesn't exist anywhere",
      async () => {
        const readTextFileStub = stub(
          Deno,
          "readTextFile",
          (_path: string | URL) => {
            throw new Deno.errors.NotFound("File not found");
          },
        );
        try {
          const req = new Request("http://localhost/theme.css", {
            headers: { Cookie: "session=mock" },
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 404);
          const body = await res.json();
          assertEquals(body.error, "Not found");
        } finally {
          readTextFileStub.restore();
        }
      },
    );

    await t.step(
      "GET / returns 404 when index.html doesn't exist anywhere",
      async () => {
        const readTextFileStub = stub(
          Deno,
          "readTextFile",
          (_path: string | URL) => {
            throw new Deno.errors.NotFound("File not found");
          },
        );
        try {
          const req = new Request("http://localhost/", {
            headers: { Cookie: "session=mock" },
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 404);
          const body = await res.json();
          assertEquals(body.error, "Not found");
        } finally {
          readTextFileStub.restore();
        }
      },
    );

    await t.step(
      "GET /unknown-path returns 404 when index.html doesn't exist (SPA catch-all)",
      async () => {
        const readTextFileStub = stub(
          Deno,
          "readTextFile",
          (_path: string | URL) => {
            throw new Deno.errors.NotFound("File not found");
          },
        );
        try {
          const req = new Request("http://localhost/some/deep/path", {
            headers: { Cookie: "session=mock" },
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 404);
          const body = await res.json();
          assertEquals(body.error, "Not found");
        } finally {
          readTextFileStub.restore();
        }
      },
    );

    await t.step(
      "GET /app.js.map returns source map when available",
      async () => {
        // Set a known source map value
        _setBundleState("console.log('test')", '{"version":3}');
        try {
          const req = new Request("http://localhost/app.js.map", {
            headers: { Cookie: "session=mock" },
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 200);
          assertEquals(res.headers.get("Content-Type"), "application/json");
          const body = await res.text();
          assertEquals(body, '{"version":3}');
        } finally {
          // Restore to null for the next test
          _setBundleState("console.log('test')", null);
        }
      },
    );

    await t.step(
      "GET /app.js.map returns 404 when source map is null",
      async () => {
        // source map is already null from previous step's finally
        const req = new Request("http://localhost/app.js.map", {
          headers: { Cookie: "session=mock" },
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 404);
        const body = await res.json();
        assertEquals(body.error, "Source map not available");
      },
    );

    await t.step(
      "bundleFrontend with isDev=false produces no source map",
      async () => {
        await bundleFrontend(false);
        const req = new Request("http://localhost/app.js.map", {
          headers: { Cookie: "session=mock" },
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 404);
        // Restore dev bundle for other tests
        await bundleFrontend(true);
      },
    );

    await t.step("GET /app.css returns CSS when available", async () => {
      _setBundleState("console.log('test')", null, "body { color: red; }");
      try {
        const req = new Request("http://localhost/app.css", {
          headers: { Cookie: "session=mock" },
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 200);
        assertEquals(res.headers.get("Content-Type"), "text/css");
        const body = await res.text();
        assertEquals(body, "body { color: red; }");
      } finally {
        _setBundleState("console.log('test')", null, null);
      }
    });

    await t.step("GET /app.css returns 404 when CSS is null", async () => {
      _setBundleState("console.log('test')", null, null);
      const req = new Request("http://localhost/app.css", {
        headers: { Cookie: "session=mock" },
      });
      const res = await app.fetch(req);
      assertEquals(res.status, 404);
      const body = await res.json();
      assertEquals(body.error, "No CSS bundle");
    });

    await t.step(
      "GET /fonts/material-symbols-rounded.woff2 returns 404 when font not found",
      async () => {
        const readFileStub = stub(Deno, "readFile", (_path: string | URL) => {
          throw new Deno.errors.NotFound("File not found");
        });
        try {
          const req = new Request(
            "http://localhost/fonts/material-symbols-rounded.woff2",
            { headers: { Cookie: "session=mock" } },
          );
          const res = await app.fetch(req);
          assertEquals(res.status, 404);
          const body = await res.json();
          assertEquals(body.error, "Font not found");
        } finally {
          readFileStub.restore();
        }
      },
    );

    await t.step(
      "GET /fonts/material-symbols-rounded.woff2 returns font when available",
      async () => {
        const fakeFont = new Uint8Array([0x77, 0x4f, 0x46, 0x32]);
        const readFileStub = stub(
          Deno,
          "readFile",
          (_path: string | URL) => Promise.resolve(fakeFont),
        );
        try {
          const req = new Request(
            "http://localhost/fonts/material-symbols-rounded.woff2",
            { headers: { Cookie: "session=mock" } },
          );
          const res = await app.fetch(req);
          assertEquals(res.status, 200);
          assertEquals(res.headers.get("Content-Type"), "font/woff2");
          assertEquals(
            res.headers.get("Cache-Control"),
            "public, max-age=31536000, immutable",
          );
        } finally {
          readFileStub.restore();
        }
      },
    );

    await t.step(
      "GET /api/live-reload returns SSE stream in dev mode",
      async () => {
        const time = new FakeTime();
        try {
          const controller = new AbortController();
          const req = new Request("http://localhost/api/live-reload", {
            headers: { Cookie: "session=mock" },
            signal: controller.signal,
          });
          const res = await app.fetch(req);
          assertEquals(res.status, 200);
          assertEquals(res.headers.get("Content-Type"), "text/event-stream");
          assertEquals(res.headers.get("Cache-Control"), "no-cache");
          // Advance time to trigger the heartbeat interval
          await time.tickAsync(30000);
          // Abort to trigger cleanup (covers abort event listener and clearInterval)
          controller.abort();
          await res.body?.cancel();
        } finally {
          time.restore();
        }
      },
    );

    await t.step(
      "bundleFrontend with no-CSS entry produces no CSS bundle",
      async () => {
        // Bundle a JS-only file to cover the cssFile falsy branch
        _setBundleState("console.log('test')", null, null);
        await bundleFrontend(false, "./tests/fixtures/no-css-entry.ts");
        const req = new Request("http://localhost/app.css", {
          headers: { Cookie: "session=mock" },
        });
        const res = await app.fetch(req);
        assertEquals(res.status, 404);
        // Restore real bundle
        await bundleFrontend(true);
      },
    );
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
