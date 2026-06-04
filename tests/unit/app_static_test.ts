// Unit tests for app static file fallback paths
// Tests the 404 responses when static files don't exist

import { assertEquals } from "@std/assert";
import { stub } from "@std/testing/mock";
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
  },
  sanitizeOps: false,
  sanitizeResources: false,
});
