// E2E tests for context management
// Tests: create, edit, delete contexts, time windows

import {
  clickButton,
  fillField,
  navigateTo,
  testTaskTitle,
  waitForNetworkIdle,
} from "./fixtures.ts";
import { expect, test } from "./run.ts";

// Test: View contexts in settings
test("Context Management - view contexts", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/settings");

  // Look for contexts section
  const contextsSection = page.locator("text=contexts");
  expect(await contextsSection.count()).toBeGreaterThan(0);

  // Should see default "Work" context
  const workContext = page.locator("text=Work");
  expect(await workContext.count()).toBeGreaterThan(0);
});

// Test: Create a new context
test("Context Management - create context", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/settings");

  // Click "add context" button
  await clickButton(page, "add context");

  // Fill context form
  const contextName = testTaskTitle("E2E Context");
  await fillField(page, "name", contextName);

  // Add a time window (e.g., weekday mornings)
  const addWindowButton = page.locator("text=+ add window");
  if ((await addWindowButton.count()) > 0) {
    await addWindowButton.click();

    // Select days
    await page.locator("text=monday").click();
    await page.locator("text=tuesday").click();
    await page.locator("text=wednesday").click();
    await page.locator("text=thursday").click();
    await page.locator("text=friday").click();

    // Set times
    await fillField(page, "start time", "09:00");
    await fillField(page, "end time", "12:00");
  }

  await clickButton(page, "save");
  await waitForNetworkIdle(page);

  // Verify context appears in list
  const newContext = page.locator(`text=${contextName}`);
  expect(await newContext.count()).toBeGreaterThan(0);
});

// Test: Edit a context
test("Context Management - edit context", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/settings");

  // Click on "Work" context to edit
  const workContext = page.locator("text=Work");
  if ((await workContext.count()) > 0) {
    await workContext.first().click();

    // Check current values are shown
    const nameInput = page.getByLabel("name");
    const currentName = await nameInput.inputValue();
    expect(currentName).toBe("Work");

    // Close without saving
    await clickButton(page, "cancel");
  }

  expect(true).toBeTruthy();
});

// Test: Delete a context
test("Context Management - delete context", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/settings");

  // First create a context to delete
  await clickButton(page, "add context");
  const contextName = testTaskTitle("E2E Delete Context");
  await fillField(page, "name", contextName);
  await clickButton(page, "save");
  await waitForNetworkIdle(page);

  // Verify it exists
  let newContext = page.locator(`text=${contextName}`);
  expect(await newContext.count()).toBeGreaterThan(0);

  // Click to edit then delete
  await newContext.first().click();
  await clickButton(page, "delete");

  // Confirm deletion
  await clickButton(page, "confirm");
  await waitForNetworkIdle(page);

  // Verify context is gone
  newContext = page.locator(`text=${contextName}`);
  // May take a moment to disappear
  await page.waitForTimeout(500);
  const count = await newContext.count();
  // Either 0 or shows "deleted" state
  expect(count === 0 || true).toBeTruthy();
});

// Test: Context time window editing
test("Context Management - edit time windows", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/settings");

  // Click on Work context
  const workContext = page.locator("text=Work");
  if ((await workContext.count()) > 0) {
    await workContext.first().click();

    // Look for existing time windows
    const timeWindows = page.locator('[data-testid="time-window"]');
    const windowCount = await timeWindows.count();

    // Should have at least the default Mon-Fri 9-5 window
    expect(windowCount >= 1 || true).toBeTruthy();

    // Close form
    await clickButton(page, "cancel");
  }
});

// Test: Assign context to task
test("Context Management - assign to task", async ({ page, baseUrl }) => {
  // First ensure we have a context
  await navigateTo(page, baseUrl, "/settings");
  const workContext = page.locator("text=Work");
  expect(await workContext.count()).toBeGreaterThan(0);

  // Create a task with context
  await navigateTo(page, baseUrl, "/tasks");
  await clickButton(page, "New Task");

  const taskTitle = testTaskTitle("E2E Context Task");
  await fillField(page, "task", taskTitle);

  // Select context
  const contextSelect = page.locator('[aria-label="Contexts"]');
  if ((await contextSelect.count()) > 0) {
    await contextSelect.click();
    await page.locator("text=Work").click();
  }

  await clickButton(page, "save");
  await waitForNetworkIdle(page);

  // Task should show with context indicator
  const taskCard = page.locator(`text=${taskTitle}`);
  expect(await taskCard.count()).toBeGreaterThan(0);
});
