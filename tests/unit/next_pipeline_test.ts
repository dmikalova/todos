// Unit tests for the Next view pipeline logic
// Tests context window evaluation, project filtering, task filtering, and sorting

import { assertEquals } from "@std/assert";

// Types matching the store
interface TimeWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface Context {
  id: string;
  name: string;
  time_windows?: TimeWindow[];
}

interface Project {
  id: string;
  name: string;
  context_id?: string | null;
  parent_project_id?: string | null;
}

interface Task {
  id: string;
  title: string;
  project_id?: string;
  due_date?: string;
  completed_at?: string;
}

// Pure function versions of store pipeline methods

function isWindowActive(
  window: { dayOfWeek: number; startTime: string; endTime: string },
  now: Date,
): boolean {
  if (now.getDay() !== window.dayOfWeek) return false;
  const hhmm = `${String(now.getHours()).padStart(2, "0")}:${
    String(now.getMinutes()).padStart(2, "0")
  }`;
  return hhmm >= window.startTime && hhmm < window.endTime;
}

function getActiveContextIds(contexts: Context[], now: Date): string[] {
  return contexts
    .filter((c) => {
      if (!c.time_windows || c.time_windows.length === 0) return true;
      return c.time_windows.some((w) => isWindowActive(w, now));
    })
    .map((c) => c.id);
}

function resolveProjectContext(
  project: Project,
  projects: Project[],
): string | null {
  if (project.context_id) return project.context_id;
  if (!project.parent_project_id) return null;
  const parent = projects.find((p) => p.id === project.parent_project_id);
  if (!parent) return null;
  return resolveProjectContext(parent, projects);
}

function getNextProjects(
  projects: Project[],
  activeContextIds: string[],
): Project[] {
  return projects.filter((p) => {
    const ctx = resolveProjectContext(p, projects);
    return ctx !== null && activeContextIds.includes(ctx);
  });
}

function filterNextTasks(
  tasks: Task[],
  nextProjectIds: string[],
  now: Date = new Date(),
): Task[] {
  const today = now.toISOString().split("T")[0];
  return tasks.filter(
    (t) =>
      t.project_id &&
      nextProjectIds.includes(t.project_id) &&
      !t.completed_at &&
      (!t.due_date || t.due_date.split("T")[0] <= today),
  );
}

function sortNextTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });
}

// ---------------------------------------------------------------------------
// getActiveContextIds Tests
// ---------------------------------------------------------------------------

Deno.test(
  "getActiveContextIds - returns only contexts with active windows",
  () => {
    const contexts: Context[] = [
      {
        id: "work",
        name: "Work",
        time_windows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
      },
      {
        id: "evening",
        name: "Evening",
        time_windows: [{ dayOfWeek: 1, startTime: "18:00", endTime: "22:00" }],
      },
    ];

    // Monday at 10:00 AM — only "work" is active
    const now = new Date("2026-02-23T10:00:00");
    const ids = getActiveContextIds(contexts, now);

    assertEquals(ids, ["work"]);
  },
);

Deno.test(
  "getActiveContextIds - context with no windows is always active",
  () => {
    const contexts: Context[] = [
      { id: "always", name: "Always" },
      {
        id: "work",
        name: "Work",
        time_windows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
      },
    ];

    // Sunday — "work" is inactive, but "always" (no windows) is active
    const now = new Date("2026-02-22T10:00:00");
    assertEquals(now.getDay(), 0);
    const ids = getActiveContextIds(contexts, now);

    assertEquals(ids, ["always"]);
  },
);

Deno.test(
  "getActiveContextIds - multiple active windows on same context",
  () => {
    const contexts: Context[] = [
      {
        id: "work",
        name: "Work",
        time_windows: [
          { dayOfWeek: 1, startTime: "09:00", endTime: "12:00" },
          { dayOfWeek: 1, startTime: "13:00", endTime: "17:00" },
        ],
      },
    ];

    // Monday at 14:00 — afternoon window is active
    const now = new Date("2026-02-23T14:00:00");
    const ids = getActiveContextIds(contexts, now);

    assertEquals(ids, ["work"]);
  },
);

// ---------------------------------------------------------------------------
// getNextProjects Tests
// ---------------------------------------------------------------------------

Deno.test("getNextProjects - filters by active context", () => {
  const projects: Project[] = [
    { id: "p1", name: "Work Project", context_id: "work" },
    { id: "p2", name: "Evening Project", context_id: "evening" },
    { id: "p3", name: "No Context", context_id: null },
  ];

  const result = getNextProjects(projects, ["work"]);
  assertEquals(
    result.map((p) => p.id),
    ["p1"],
  );
});

Deno.test("getNextProjects - inherited context counts for filtering", () => {
  const projects: Project[] = [
    { id: "parent", name: "Parent", context_id: "work" },
    { id: "child", name: "Child", parent_project_id: "parent" },
  ];

  const result = getNextProjects(projects, ["work"]);
  assertEquals(result.map((p) => p.id).sort(), ["child", "parent"]);
});

Deno.test("getNextProjects - excludes projects with no context", () => {
  const projects: Project[] = [
    { id: "p1", name: "No Context" },
    { id: "p2", name: "Null Context", context_id: null },
  ];

  const result = getNextProjects(projects, ["work"]);
  assertEquals(result, []);
});

// ---------------------------------------------------------------------------
// filterNextTasks Tests
// ---------------------------------------------------------------------------

Deno.test("filterNextTasks - excludes inbox tasks (no project)", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Inbox Task", completed_at: undefined },
    {
      id: "t2",
      title: "Project Task",
      project_id: "p1",
      completed_at: undefined,
    },
  ];

  const result = filterNextTasks(tasks, ["p1"]);
  assertEquals(
    result.map((t) => t.id),
    ["t2"],
  );
});

Deno.test("filterNextTasks - excludes completed tasks", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Open", project_id: "p1" },
    {
      id: "t2",
      title: "Done",
      project_id: "p1",
      completed_at: "2026-01-01T00:00:00Z",
    },
  ];

  const result = filterNextTasks(tasks, ["p1"]);
  assertEquals(
    result.map((t) => t.id),
    ["t1"],
  );
});

Deno.test("filterNextTasks - excludes tasks from non-next projects", () => {
  const tasks: Task[] = [
    { id: "t1", title: "Next", project_id: "p1" },
    { id: "t2", title: "Other", project_id: "p2" },
  ];

  const result = filterNextTasks(tasks, ["p1"]);
  assertEquals(
    result.map((t) => t.id),
    ["t1"],
  );
});

Deno.test("filterNextTasks - excludes tasks with future due date", () => {
  const now = new Date("2026-03-08T12:00:00");
  const tasks: Task[] = [
    { id: "t1", title: "Due today", project_id: "p1", due_date: "2026-03-08" },
    {
      id: "t2",
      title: "Due tomorrow",
      project_id: "p1",
      due_date: "2026-03-09",
    },
    { id: "t3", title: "Overdue", project_id: "p1", due_date: "2026-03-01" },
    { id: "t4", title: "No due date", project_id: "p1" },
  ];

  const result = filterNextTasks(tasks, ["p1"], now);
  assertEquals(
    result.map((t) => t.id),
    ["t1", "t3", "t4"],
  );
});

// ---------------------------------------------------------------------------
// sortNextTasks Tests
// ---------------------------------------------------------------------------

Deno.test("sortNextTasks - sorts by due date ascending, undated last", () => {
  const tasks: Task[] = [
    { id: "t1", title: "No date" },
    { id: "t2", title: "Later", due_date: "2026-03-15" },
    { id: "t3", title: "Sooner", due_date: "2026-03-01" },
    { id: "t4", title: "Also no date" },
  ];

  const result = sortNextTasks(tasks);
  assertEquals(
    result.map((t) => t.id),
    ["t3", "t2", "t1", "t4"],
  );
});

Deno.test("sortNextTasks - all undated preserves order", () => {
  const tasks: Task[] = [
    { id: "t1", title: "A" },
    { id: "t2", title: "B" },
    { id: "t3", title: "C" },
  ];

  const result = sortNextTasks(tasks);
  assertEquals(
    result.map((t) => t.id),
    ["t1", "t2", "t3"],
  );
});

Deno.test("sortNextTasks - all dated sorts correctly", () => {
  const tasks: Task[] = [
    { id: "t1", title: "March", due_date: "2026-03-01" },
    { id: "t2", title: "January", due_date: "2026-01-15" },
    { id: "t3", title: "February", due_date: "2026-02-10" },
  ];

  const result = sortNextTasks(tasks);
  assertEquals(
    result.map((t) => t.id),
    ["t2", "t3", "t1"],
  );
});

// ---------------------------------------------------------------------------
// Full Pipeline Tests
// ---------------------------------------------------------------------------

Deno.test("full pipeline - filters and sorts correctly", () => {
  const contexts: Context[] = [
    {
      id: "work",
      name: "Work",
      time_windows: [{ dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }],
    },
    {
      id: "evening",
      name: "Evening",
      time_windows: [{ dayOfWeek: 1, startTime: "18:00", endTime: "22:00" }],
    },
  ];

  const projects: Project[] = [
    { id: "p-work", name: "Work Project", context_id: "work" },
    { id: "p-evening", name: "Evening Project", context_id: "evening" },
  ];

  const tasks: Task[] = [
    {
      id: "t1",
      title: "Work task later",
      project_id: "p-work",
      due_date: "2026-02-23",
    },
    {
      id: "t2",
      title: "Work task sooner",
      project_id: "p-work",
      due_date: "2026-02-20",
    },
    { id: "t3", title: "Evening task", project_id: "p-evening" },
    { id: "t4", title: "Inbox task" },
    {
      id: "t5",
      title: "Completed work task",
      project_id: "p-work",
      completed_at: "2026-01-01T00:00:00Z",
    },
  ];

  // Monday at 10:00 — work context active, evening inactive
  const now = new Date("2026-02-23T10:00:00");

  const activeContextIds = getActiveContextIds(contexts, now);
  const nextProjects = getNextProjects(projects, activeContextIds);
  const nextProjectIds = nextProjects.map((p) => p.id);
  const filtered = filterNextTasks(tasks, nextProjectIds, now);
  const sorted = sortNextTasks(filtered);

  assertEquals(
    sorted.map((t) => t.id),
    ["t2", "t1"],
  );
});
