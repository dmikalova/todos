// Unit tests for project task count logic

import { assertEquals } from "@std/assert";

interface Task {
  id: string;
  project_id?: string;
  completed_at?: string;
}

/**
 * Count open (non-completed) tasks for a given project.
 * Mirrors the task_count logic in the projects API.
 */
function getOpenTaskCount(tasks: Task[], projectId: string): number {
  return tasks.filter((t) => t.project_id === projectId && !t.completed_at)
    .length;
}

Deno.test("getOpenTaskCount - excludes completed tasks", () => {
  const tasks: Task[] = [
    { id: "t1", project_id: "p1" },
    { id: "t2", project_id: "p1", completed_at: "2026-01-01T00:00:00Z" },
    { id: "t3", project_id: "p1" },
  ];

  assertEquals(getOpenTaskCount(tasks, "p1"), 2);
});

Deno.test("getOpenTaskCount - zero when all tasks are done", () => {
  const tasks: Task[] = [
    { id: "t1", project_id: "p1", completed_at: "2026-01-01T00:00:00Z" },
    { id: "t2", project_id: "p1", completed_at: "2026-01-02T00:00:00Z" },
  ];

  assertEquals(getOpenTaskCount(tasks, "p1"), 0);
});

Deno.test("getOpenTaskCount - zero when no tasks for project", () => {
  const tasks: Task[] = [{ id: "t1", project_id: "other" }];

  assertEquals(getOpenTaskCount(tasks, "p1"), 0);
});

Deno.test("getOpenTaskCount - does not count tasks from other projects", () => {
  const tasks: Task[] = [
    { id: "t1", project_id: "p1" },
    { id: "t2", project_id: "p2" },
    { id: "t3", project_id: "p1" },
  ];

  assertEquals(getOpenTaskCount(tasks, "p1"), 2);
  assertEquals(getOpenTaskCount(tasks, "p2"), 1);
});
