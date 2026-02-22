// E2E test fixtures and helpers
// Common utilities for all E2E tests

import type { Page } from "playwright";

// Wait for API response
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp,
  method = "GET",
): Promise<Response> {
  const response = await page.waitForResponse(
    (res) =>
      (typeof urlPattern === "string"
        ? res.url().includes(urlPattern)
        : urlPattern.test(res.url())) && res.request().method() === method,
  );
  return response;
}

// Navigate to a page and wait for load
export async function navigateTo(
  page: Page,
  baseUrl: string,
  path: string,
): Promise<void> {
  await page.goto(`${baseUrl}${path}`);
  await page.waitForLoadState("networkidle");
}

// Fill a form field by label
export async function fillField(
  page: Page,
  label: string,
  value: string,
): Promise<void> {
  const field = page.getByLabel(label);
  await field.fill(value);
}

// Click a button by text
export async function clickButton(page: Page, text: string): Promise<void> {
  const button = page.getByRole("button", { name: text });
  await button.click();
}

// Get text content of an element
export async function getText(page: Page, selector: string): Promise<string> {
  const element = page.locator(selector);
  return (await element.textContent()) || "";
}

// Check if element exists
export async function elementExists(
  page: Page,
  selector: string,
): Promise<boolean> {
  const count = await page.locator(selector).count();
  return count > 0;
}

// Wait for network to be idle
export async function waitForNetworkIdle(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");
}

// Seed test data via API
export async function seedTask(
  page: Page,
  baseUrl: string,
  task: {
    title: string;
    description?: string;
    due_date?: string;
    project_id?: string;
    context_ids?: string[];
  },
): Promise<string> {
  const response = await page.request.post(`${baseUrl}/api/tasks`, {
    data: task,
  });
  const data = await response.json();
  return data.id;
}

// Clean up test data via API
export async function deleteTask(
  page: Page,
  baseUrl: string,
  taskId: string,
): Promise<void> {
  await page.request.delete(`${baseUrl}/api/tasks/${taskId}`);
}

// Generate unique test ID
export function uniqueId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Create a task with unique title for test isolation
export function testTaskTitle(prefix: string): string {
  return `${prefix} ${uniqueId()}`;
}
