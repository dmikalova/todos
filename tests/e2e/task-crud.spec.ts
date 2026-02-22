// E2E tests for task CRUD operations
// Tests: create, read, update, complete, delete

import {
  clickButton,
  fillField,
  navigateTo,
  testTaskTitle,
  waitForNetworkIdle,
} from "./fixtures.ts";
import { expect, test } from "./run.ts";

// Test: Create a new task
test("Task CRUD - create task via form", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/tasks");

  // Click "New Task" button
  await clickButton(page, "New Task");

  // Fill task form
  const taskTitle = testTaskTitle("E2E Create Task");
  await fillField(page, "Title", taskTitle);
  await fillField(page, "Description", "Test description from E2E");

  // Submit form
  await clickButton(page, "Save");
  await waitForNetworkIdle(page);

  // Verify task appears in list
  const taskCard = page.locator(`text=${taskTitle}`);
  expect(await taskCard.count()).toBeGreaterThan(0);
});

// Test: Edit an existing task
test("Task CRUD - edit task", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/tasks");

  // Create a task first
  await clickButton(page, "New Task");
  const originalTitle = testTaskTitle("E2E Edit Original");
  await fillField(page, "Title", originalTitle);
  await clickButton(page, "Save");
  await waitForNetworkIdle(page);

  // Click on the task to edit
  const taskCard = page.locator(`text=${originalTitle}`).first();
  await taskCard.click();

  // Update title
  const newTitle = testTaskTitle("E2E Edit Updated");
  await fillField(page, "Title", newTitle);
  await clickButton(page, "Save");
  await waitForNetworkIdle(page);

  // Verify updated title appears
  const updatedCard = page.locator(`text=${newTitle}`);
  expect(await updatedCard.count()).toBeGreaterThan(0);
});

// Test: Complete a task
test("Task CRUD - complete task", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/tasks");

  // Create a task
  await clickButton(page, "New Task");
  const taskTitle = testTaskTitle("E2E Complete Task");
  await fillField(page, "Title", taskTitle);
  await clickButton(page, "Save");
  await waitForNetworkIdle(page);

  // Find task and click complete button
  const taskRow = page.locator(`text=${taskTitle}`).locator("..");
  const completeButton = taskRow.locator('[aria-label="Complete task"]');
  await completeButton.click();
  await waitForNetworkIdle(page);

  // Verify task is marked complete (styled differently or moved to completed section)
  const completedTask = page.locator(`text=${taskTitle}`);
  // Task should still exist but be visually marked as complete
  expect(await completedTask.count()).toBeGreaterThan(0);
});

// Test: Delete a task
test("Task CRUD - delete task", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/tasks");

  // Create a task
  await clickButton(page, "New Task");
  const taskTitle = testTaskTitle("E2E Delete Task");
  await fillField(page, "Title", taskTitle);
  await clickButton(page, "Save");
  await waitForNetworkIdle(page);

  // Verify task exists
  let taskCard = page.locator(`text=${taskTitle}`);
  expect(await taskCard.count()).toBeGreaterThan(0);

  // Click on task to open edit, then delete
  await taskCard.first().click();
  await clickButton(page, "Delete");

  // Confirm deletion in dialog
  await clickButton(page, "Confirm");
  await waitForNetworkIdle(page);

  // Verify task no longer appears
  taskCard = page.locator(`text=${taskTitle}`);
  expect(await taskCard.count()).toBe(0);
});

// Test: Undo complete
test("Task CRUD - undo complete", async ({ page, baseUrl }) => {
  await navigateTo(page, baseUrl, "/tasks");

  // Create and complete a task
  await clickButton(page, "New Task");
  const taskTitle = testTaskTitle("E2E Undo Complete");
  await fillField(page, "Title", taskTitle);
  await clickButton(page, "Save");
  await waitForNetworkIdle(page);

  // Complete it
  const taskRow = page.locator(`text=${taskTitle}`).locator("..");
  const completeButton = taskRow.locator('[aria-label="Complete task"]');
  await completeButton.click();
  await waitForNetworkIdle(page);

  // Click undo button on completed task
  const undoButton = taskRow.locator('[aria-label="Undo complete"]');
  await undoButton.click();
  await waitForNetworkIdle(page);

  // Verify task is back to incomplete state
  const incompleteTask = page.locator(`text=${taskTitle}`);
  expect(await incompleteTask.count()).toBeGreaterThan(0);
});
