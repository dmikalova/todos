// Integration test configuration
// Provides database and API clients for integration tests

import { assertEquals } from "@std/assert";
import postgres from "postgres";
import { app } from "../../src/app.ts";

// Test user UUID — must match dev bypass in src/middleware.ts
export const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

// Test database configuration
// Uses superuser connection for setup/cleanup (bypasses RLS)
const TEST_DATABASE_URL = Deno.env.get("TEST_DATABASE_URL") ||
  "postgres://todos:todos@localhost:5432/todos";

// Create a test database client (superuser, bypasses RLS for setup/cleanup)
export function createTestDb() {
  return postgres(TEST_DATABASE_URL, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 30,
  });
}

// Create a test app instance
export function createTestApp() {
  return app;
}

// Test context for managing database state
export interface TestContext {
  db: ReturnType<typeof postgres>;
  app: typeof app;
}

// Setup test context before tests
export async function setupTestContext(): Promise<TestContext> {
  const db = createTestDb();
  const testApp = createTestApp();

  // Clean up any existing test data
  await cleanTestData(db);

  return { db, app: testApp };
}

// Cleanup test context after tests
export async function teardownTestContext(ctx: TestContext): Promise<void> {
  await cleanTestData(ctx.db);
  await ctx.db.end();
}

// Clean test data from database
async function cleanTestData(db: ReturnType<typeof postgres>): Promise<void> {
  // Delete in reverse dependency order, matching by name/title patterns (not UUID ids)
  await db`DELETE FROM todos.recurrence_rules WHERE task_id IN (SELECT id FROM todos.tasks WHERE title LIKE 'Integration Test%')`;
  await db`DELETE FROM todos.task_history WHERE task_id IN (SELECT id FROM todos.tasks WHERE title LIKE 'Integration Test%')`;
  await db`DELETE FROM todos.tasks WHERE title LIKE 'Integration Test%'`;
  await db`DELETE FROM todos.context_time_windows WHERE context_id IN (SELECT id FROM todos.contexts WHERE name LIKE 'Test Context%' OR name LIKE 'RLS %' OR name LIKE 'Other User%')`;
  await db`DELETE FROM todos.contexts WHERE name LIKE 'Test Context%' OR name LIKE 'RLS %' OR name LIKE 'Other User%'`;
  await db`DELETE FROM todos.projects WHERE name LIKE 'Test Project%' OR name LIKE 'RLS %' OR name LIKE 'Other User%' OR name LIKE 'Integration Test%'`;
}

// Create a mock authenticated request
export function mockAuthRequest(
  method: string,
  path: string,
  body?: unknown,
): Request {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    // Mock session cookie - in production this would be a real JWT
    Cookie: "session=mock-test-session",
  };

  const init: RequestInit = {
    method,
    headers,
  };

  if (body) {
    init.body = JSON.stringify(body);
  }

  return new Request(`http://localhost${path}`, init);
}

// Helper to make authenticated API calls in tests
export function apiCall(
  testApp: typeof app,
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const req = mockAuthRequest(method, path, body);
  return Promise.resolve(testApp.fetch(req));
}

// Helper to assert API response
export async function assertApiResponse(
  response: Response,
  expectedStatus: number,
  expectedBody?: unknown,
): Promise<void> {
  assertEquals(response.status, expectedStatus);

  if (expectedBody) {
    const body = await response.json();
    assertEquals(body, expectedBody);
  }
}

// Generate unique test IDs
export function testId(prefix: string): string {
  return `test-${prefix}-${Date.now()}-${
    Math.random()
      .toString(36)
      .substr(2, 9)
  }`;
}
