// Integration test configuration
// Provides database and API clients for integration tests

import postgres from "postgres";
import { app } from "../../src/app.ts";

// Test user UUID — must match dev bypass in src/middleware.ts
const TEST_USER_ID = "00000000-0000-0000-0000-000000000001";

// Test database configuration
// Uses superuser connection for setup/cleanup (bypasses RLS)
const TEST_DATABASE_URL = Deno.env.get("TEST_DATABASE_URL") ||
  "postgres://tasks:tasks@localhost:5432/tasks";

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
  userId: string;
}

// Setup test context before tests
export async function setupTestContext(): Promise<TestContext> {
  const db = createTestDb();
  const testApp = createTestApp();

  // Clean up any existing test data
  await cleanTestData(db);

  return { db, app: testApp, userId: TEST_USER_ID };
}

// Cleanup test context after tests
export async function teardownTestContext(ctx: TestContext): Promise<void> {
  await cleanTestData(ctx.db);
  await ctx.db.end();
}

// Clean test data from database
async function cleanTestData(db: ReturnType<typeof postgres>): Promise<void> {
  // Delete all data for the test user in reverse dependency order
  await db`DELETE FROM tasks.user_settings WHERE user_id = ${TEST_USER_ID}`;
  await db`DELETE FROM tasks.user_next_selection WHERE user_id = ${TEST_USER_ID}`;
  await db`DELETE FROM tasks.recurrence_rules WHERE task_id IN (SELECT id FROM tasks.tasks WHERE user_id = ${TEST_USER_ID})`;
  await db`DELETE FROM tasks.task_history WHERE task_id IN (SELECT id FROM tasks.tasks WHERE user_id = ${TEST_USER_ID})`;
  await db`DELETE FROM tasks.task_contexts WHERE task_id IN (SELECT id FROM tasks.tasks WHERE user_id = ${TEST_USER_ID})`;
  await db`DELETE FROM tasks.tasks WHERE user_id = ${TEST_USER_ID}`;
  await db`DELETE FROM tasks.saved_filters WHERE user_id = ${TEST_USER_ID}`;
  await db`DELETE FROM tasks.project_contexts WHERE project_id IN (SELECT id FROM tasks.projects WHERE user_id = ${TEST_USER_ID})`;
  await db`DELETE FROM tasks.context_time_windows WHERE context_id IN (SELECT id FROM tasks.contexts WHERE user_id = ${TEST_USER_ID})`;
  await db`DELETE FROM tasks.contexts WHERE user_id = ${TEST_USER_ID}`;
  await db`DELETE FROM tasks.projects WHERE user_id = ${TEST_USER_ID}`;
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
