// Unit tests for store computed properties
// Tests inboxTasks, inboxCount, projectTasks, dueTasks, currentPageTitle

import { assertEquals } from "@std/assert";

interface Task {
  id: string;
  title: string;
  project_id?: string;
  due_date?: string;
  completed_at?: string;
}

interface Project {
  id: string;
  name: string;
  context_id?: string | null;
  parent_project_id?: string | null;
}

interface Context {
  id: string;
  name: string;
}

// Pure function equivalents of store computed properties

function getInboxTasks(tasks: Task[], filter: { completed: string }): Task[] {
  return tasks.filter((task) => {
    if (task.project_id) return false;
    if (filter.completed === "true" && !task.completed_at) return false;
    if (filter.completed === "false" && task.completed_at) return false;
    return true;
  });
}

function getInboxCount(tasks: Task[]): number {
  return tasks.filter((t) => !t.project_id && !t.completed_at).length;
}

function getDueTasks(tasks: Task[]): Task[] {
  return tasks
    .filter((t) => t.due_date && !t.completed_at)
    .sort(
      (a, b) =>
        new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime(),
    );
}

function getProjectTasks(
  tasks: Task[],
  projectId: string | null,
  filter: { completed: string },
): Task[] {
  if (!projectId) return [];
  return tasks.filter(
    (t) =>
      t.project_id === projectId &&
      (filter.completed === "true" ? t.completed_at : !t.completed_at),
  );
}

function getCurrentPageTitle(
  tab: string,
  projects: Project[],
  selectedProjectId: string | null,
  contexts: Context[],
  selectedContextId: string | null,
): string {
  switch (tab) {
    case "next":
      return "next";
    case "inbox":
      return "inbox";
    case "due":
      return "due";
    case "history":
      return "history";
    case "settings":
      return "settings";
    case "project": {
      const p = projects.find((p) => p.id === selectedProjectId);
      return p?.name || "project";
    }
    case "context": {
      const c = contexts.find((c) => c.id === selectedContextId);
      return c?.name || "context";
    }
    default:
      return "todos";
  }
}

// ---------------------------------------------------------------------------
// inboxTasks Tests
// ---------------------------------------------------------------------------

Deno.test("inboxTasks - returns tasks without project_id", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Inbox", completed_at: undefined },
    { id: "t2", title: "Project", project_id: "p1" },
    { id: "t3", title: "Inbox 2", completed_at: undefined },
  ];

  const result = getInboxTasks(tasks, { completed: "false" });
  assertEquals(
    result.map((t) => t.id),
    ["t1", "t3"],
  );
});

Deno.test("inboxTasks - completed filter excludes open tasks", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Open" },
    { id: "t2", title: "Done", completed_at: "2026-01-01T00:00:00Z" },
  ];

  const result = getInboxTasks(tasks, { completed: "true" });
  assertEquals(
    result.map((t) => t.id),
    ["t2"],
  );
});

Deno.test("inboxTasks - open filter excludes completed tasks", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Open" },
    { id: "t2", title: "Done", completed_at: "2026-01-01T00:00:00Z" },
  ];

  const result = getInboxTasks(tasks, { completed: "false" });
  assertEquals(
    result.map((t) => t.id),
    ["t1"],
  );
});

// ---------------------------------------------------------------------------
// inboxCount Tests
// ---------------------------------------------------------------------------

Deno.test("inboxCount - counts open tasks without project", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Inbox" },
    { id: "t2", title: "Done inbox", completed_at: "2026-01-01T00:00:00Z" },
    { id: "t3", title: "Project task", project_id: "p1" },
    { id: "t4", title: "Inbox 2" },
  ];

  assertEquals(getInboxCount(tasks), 2);
});

Deno.test("inboxCount - zero when all inbox tasks are completed", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Done", completed_at: "2026-01-01T00:00:00Z" },
  ];

  assertEquals(getInboxCount(tasks), 0);
});

// ---------------------------------------------------------------------------
// dueTasks Tests
// ---------------------------------------------------------------------------

Deno.test("dueTasks - returns tasks with due_date sorted ascending", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Later", due_date: "2026-03-15" },
    { id: "t2", title: "Sooner", due_date: "2026-02-01" },
    { id: "t3", title: "No date" },
  ];

  const result = getDueTasks(tasks);
  assertEquals(
    result.map((t) => t.id),
    ["t2", "t1"],
  );
});

Deno.test("dueTasks - excludes completed tasks", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Due", due_date: "2026-03-15" },
    {
      id: "t2",
      title: "Done",
      due_date: "2026-03-01",
      completed_at: "2026-01-01T00:00:00Z",
    },
  ];

  const result = getDueTasks(tasks);
  assertEquals(
    result.map((t) => t.id),
    ["t1"],
  );
});

// ---------------------------------------------------------------------------
// projectTasks Tests
// ---------------------------------------------------------------------------

Deno.test("projectTasks - returns tasks for selected project", () => {
  const tasks: Task[] = [
    { id: "t1", title: "P1 task", project_id: "p1" },
    { id: "t2", title: "P2 task", project_id: "p2" },
    { id: "t3", title: "P1 task 2", project_id: "p1" },
  ];

  const result = getProjectTasks(tasks, "p1", { completed: "false" });
  assertEquals(
    result.map((t) => t.id),
    ["t1", "t3"],
  );
});

Deno.test("projectTasks - empty when no project selected", () => {
  const tasks: Task[] = [{ id: "t1", title: "Task", project_id: "p1" }];

  const result = getProjectTasks(tasks, null, { completed: "false" });
  assertEquals(result, []);
});

Deno.test("projectTasks - respects completed filter", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Open", project_id: "p1" },
    {
      id: "t2",
      title: "Done",
      project_id: "p1",
      completed_at: "2026-01-01T00:00:00Z",
    },
  ];

  assertEquals(
    getProjectTasks(tasks, "p1", { completed: "false" }).map((t) => t.id),
    ["t1"],
  );
  assertEquals(
    getProjectTasks(tasks, "p1", { completed: "true" }).map((t) => t.id),
    ["t2"],
  );
});

// ---------------------------------------------------------------------------
// currentPageTitle Tests
// ---------------------------------------------------------------------------

Deno.test("currentPageTitle - returns tab name for standard tabs", () => {
  assertEquals(getCurrentPageTitle("next", [], null, [], null), "next");
  assertEquals(getCurrentPageTitle("inbox", [], null, [], null), "inbox");
  assertEquals(getCurrentPageTitle("due", [], null, [], null), "due");
  assertEquals(getCurrentPageTitle("history", [], null, [], null), "history");
  assertEquals(getCurrentPageTitle("settings", [], null, [], null), "settings");
});

Deno.test("currentPageTitle - returns project name when on project tab", () => {
  const projects: Project[] = [{ id: "p1", name: "My Project" }];

  assertEquals(
    getCurrentPageTitle("project", projects, "p1", [], null),
    "My Project",
  );
});

Deno.test("currentPageTitle - returns 'project' when project not found", () => {
  assertEquals(
    getCurrentPageTitle("project", [], "missing", [], null),
    "project",
  );
});

Deno.test("currentPageTitle - returns context name when on context tab", () => {
  const contexts: Context[] = [{ id: "c1", name: "Work" }];

  assertEquals(
    getCurrentPageTitle("context", [], null, contexts, "c1"),
    "Work",
  );
});

Deno.test("currentPageTitle - returns 'context' when context not found", () => {
  assertEquals(
    getCurrentPageTitle("context", [], null, [], "missing"),
    "context",
  );
});

Deno.test("currentPageTitle - returns 'todos' for unknown tab", () => {
  assertEquals(getCurrentPageTitle("unknown", [], null, [], null), "todos");
});
