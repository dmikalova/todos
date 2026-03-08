// Integration test configuration
// Provides database and API clients for integration tests

import { assertEquals } from "@std/assert";
import postgres from "postgres";
import { app } from "../../src/app.ts";

// Test database configuration
// Uses the same schema as production but a separate test database
const TEST_DATABASE_URL = Deno.env.get("TEST_DATABASE_URL") ||
  Deno.env.get("DATABASE_URL_TRANSACTION") ||
  "postgres://localhost:5432/todos_test";

// Create a test database client
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
  // Delete in reverse dependency order
  await db`DELETE FROM todos.task_contexts WHERE task_id LIKE 'test-%'`;
  await db`DELETE FROM todos.recurrence_rules WHERE task_id LIKE 'test-%'`;
  await db`DELETE FROM todos.task_history WHERE task_id LIKE 'test-%'`;
  await db`DELETE FROM todos.tasks WHERE id LIKE 'test-%' OR title LIKE 'Integration Test%'`;
  await db`DELETE FROM todos.contexts WHERE id LIKE 'test-%' OR name LIKE 'Test Context%'`;
  await db`DELETE FROM todos.projects WHERE id LIKE 'test-%' OR name LIKE 'Test Project%'`;
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
  return testApp.fetch(req);
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
