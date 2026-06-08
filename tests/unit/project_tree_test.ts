// Unit tests for project nesting: projectTree, getDescendantIds, collapse state
// Tests tree computation, alphabetical sorting, depth annotation, and collapse behavior

import { assertEquals } from "@std/assert";

interface Project {
  id: string;
  name: string;
  context_ids?: string[];
  parent_project_id?: string | null;
}

interface ProjectTreeEntry {
  project: Project;
  depth: number;
}

// Pure function equivalent of store.projectTree
function getProjectTree(
  projects: Project[],
  collapsedIds: Set<string>,
): ProjectTreeEntry[] {
  const entries: ProjectTreeEntry[] = [];
  const childrenMap = new Map<string | null, Project[]>();

  for (const project of projects) {
    const parentId = project.parent_project_id ?? null;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(project);
  }

  for (const children of childrenMap.values()) {
    children.sort((a, b) => a.name.localeCompare(b.name));
  }

  const visit = (parentId: string | null, depth: number) => {
    const children = childrenMap.get(parentId);
    if (!children) return;
    for (const project of children) {
      entries.push({ project, depth });
      if (!collapsedIds.has(project.id)) {
        visit(project.id, depth + 1);
      }
    }
  };

  visit(null, 0);
  return entries;
}

// Pure function equivalent of store.getDescendantIds
function getDescendantIds(projects: Project[], projectId: string): string[] {
  const descendants: string[] = [];
  const childrenMap = new Map<string | null, Project[]>();

  for (const project of projects) {
    const parentId = project.parent_project_id ?? null;
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(project);
  }

  const collect = (id: string) => {
    const children = childrenMap.get(id);
    if (!children) return;
    for (const child of children) {
      descendants.push(child.id);
      collect(child.id);
    }
  };

  collect(projectId);
  return descendants;
}

// Pure function equivalent of store.hasChildren
function hasChildren(projects: Project[], projectId: string): boolean {
  return projects.some((p) => p.parent_project_id === projectId);
}

// ---------------------------------------------------------------------------
// projectTree Tests
// ---------------------------------------------------------------------------

Deno.test("projectTree - empty projects returns empty", () => {
  const result = getProjectTree([], new Set());
  assertEquals(result, []);
});

Deno.test("projectTree - flat projects sorted alphabetically", () => {
  const projects: Project[] = [
    { id: "p3", name: "Charlie" },
    { id: "p1", name: "Alpha" },
    { id: "p2", name: "Bravo" },
  ];

  const result = getProjectTree(projects, new Set());
  assertEquals(
    result.map((e) => e.project.name),
    ["Alpha", "Bravo", "Charlie"],
  );
  assertEquals(
    result.map((e) => e.depth),
    [0, 0, 0],
  );
});

Deno.test(
  "projectTree - children appear after parent with correct depth",
  () => {
    const projects: Project[] = [
      { id: "p1", name: "Parent" },
      { id: "p2", name: "Child", parent_project_id: "p1" },
      { id: "p3", name: "Grandchild", parent_project_id: "p2" },
    ];

    const result = getProjectTree(projects, new Set());
    assertEquals(result.length, 3);
    assertEquals(result[0].project.id, "p1");
    assertEquals(result[0].depth, 0);
    assertEquals(result[1].project.id, "p2");
    assertEquals(result[1].depth, 1);
    assertEquals(result[2].project.id, "p3");
    assertEquals(result[2].depth, 2);
  },
);

Deno.test("projectTree - siblings at same level sorted alphabetically", () => {
  const projects: Project[] = [
    { id: "p1", name: "Parent" },
    { id: "p3", name: "Zebra", parent_project_id: "p1" },
    { id: "p2", name: "Alpha", parent_project_id: "p1" },
    { id: "p4", name: "Middle", parent_project_id: "p1" },
  ];

  const result = getProjectTree(projects, new Set());
  assertEquals(
    result.map((e) => e.project.name),
    ["Parent", "Alpha", "Middle", "Zebra"],
  );
  assertEquals(
    result.map((e) => e.depth),
    [0, 1, 1, 1],
  );
});

Deno.test("projectTree - deep nesting produces correct depths", () => {
  const projects: Project[] = [
    { id: "p1", name: "L0" },
    { id: "p2", name: "L1", parent_project_id: "p1" },
    { id: "p3", name: "L2", parent_project_id: "p2" },
    { id: "p4", name: "L3", parent_project_id: "p3" },
    { id: "p5", name: "L4", parent_project_id: "p4" },
    { id: "p6", name: "L5", parent_project_id: "p5" },
  ];

  const result = getProjectTree(projects, new Set());
  assertEquals(
    result.map((e) => e.depth),
    [0, 1, 2, 3, 4, 5],
  );
});

Deno.test(
  "projectTree - multiple roots with children interleaved correctly",
  () => {
    const projects: Project[] = [
      { id: "p1", name: "Beta" },
      { id: "p2", name: "Alpha" },
      { id: "p3", name: "Beta Child", parent_project_id: "p1" },
      { id: "p4", name: "Alpha Child", parent_project_id: "p2" },
    ];

    const result = getProjectTree(projects, new Set());
    assertEquals(
      result.map((e) => ({ name: e.project.name, depth: e.depth })),
      [
        { name: "Alpha", depth: 0 },
        { name: "Alpha Child", depth: 1 },
        { name: "Beta", depth: 0 },
        { name: "Beta Child", depth: 1 },
      ],
    );
  },
);

Deno.test(
  "projectTree - handles null and undefined parent_project_id as root",
  () => {
    const projects: Project[] = [
      { id: "p1", name: "Null Parent", parent_project_id: null },
      { id: "p2", name: "Undefined Parent" },
    ];

    const result = getProjectTree(projects, new Set());
    assertEquals(result.length, 2);
    assertEquals(
      result.map((e) => e.depth),
      [0, 0],
    );
  },
);

// ---------------------------------------------------------------------------
// projectTree Collapse Tests
// ---------------------------------------------------------------------------

Deno.test("projectTree - collapsed parent hides all descendants", () => {
  const projects: Project[] = [
    { id: "p1", name: "Parent" },
    { id: "p2", name: "Child", parent_project_id: "p1" },
    { id: "p3", name: "Grandchild", parent_project_id: "p2" },
    { id: "p4", name: "Other Root" },
  ];

  const result = getProjectTree(projects, new Set(["p1"]));
  assertEquals(
    result.map((e) => e.project.name),
    ["Other Root", "Parent"],
  );
});

Deno.test("projectTree - collapsed intermediate hides only subtree", () => {
  const projects: Project[] = [
    { id: "p1", name: "Root" },
    { id: "p2", name: "Branch A", parent_project_id: "p1" },
    { id: "p3", name: "Leaf A1", parent_project_id: "p2" },
    { id: "p4", name: "Branch B", parent_project_id: "p1" },
  ];

  // Collapse Branch A — its child is hidden but Branch B still shows
  const result = getProjectTree(projects, new Set(["p2"]));
  assertEquals(
    result.map((e) => e.project.name),
    ["Root", "Branch A", "Branch B"],
  );
});

Deno.test("projectTree - expand reveals subtree", () => {
  const projects: Project[] = [
    { id: "p1", name: "Parent" },
    { id: "p2", name: "Child", parent_project_id: "p1" },
  ];

  // Collapsed
  const collapsed = getProjectTree(projects, new Set(["p1"]));
  assertEquals(collapsed.length, 1);

  // Expanded (empty collapsed set)
  const expanded = getProjectTree(projects, new Set());
  assertEquals(expanded.length, 2);
  assertEquals(expanded[1].project.name, "Child");
});

Deno.test(
  "projectTree - nested collapse: collapsing grandparent hides all",
  () => {
    const projects: Project[] = [
      { id: "p1", name: "Grandparent" },
      { id: "p2", name: "Parent", parent_project_id: "p1" },
      { id: "p3", name: "Child", parent_project_id: "p2" },
    ];

    // Both p1 and p2 collapsed — only p1 shown
    const result = getProjectTree(projects, new Set(["p1", "p2"]));
    assertEquals(result.length, 1);
    assertEquals(result[0].project.name, "Grandparent");

    // Only p2 collapsed — p1 and p2 shown but not p3
    const result2 = getProjectTree(projects, new Set(["p2"]));
    assertEquals(result2.length, 2);
    assertEquals(
      result2.map((e) => e.project.name),
      ["Grandparent", "Parent"],
    );
  },
);

Deno.test("projectTree - collapsing leaf project has no effect", () => {
  const projects: Project[] = [
    { id: "p1", name: "Parent" },
    { id: "p2", name: "Leaf", parent_project_id: "p1" },
  ];

  const result = getProjectTree(projects, new Set(["p2"]));
  assertEquals(result.length, 2);
});

// ---------------------------------------------------------------------------
// getDescendantIds Tests
// ---------------------------------------------------------------------------

Deno.test("getDescendantIds - single child", () => {
  const projects: Project[] = [
    { id: "p1", name: "Parent" },
    { id: "p2", name: "Child", parent_project_id: "p1" },
  ];

  assertEquals(getDescendantIds(projects, "p1"), ["p2"]);
});

Deno.test("getDescendantIds - multi-level descendants", () => {
  const projects: Project[] = [
    { id: "p1", name: "Root" },
    { id: "p2", name: "Child", parent_project_id: "p1" },
    { id: "p3", name: "Grandchild", parent_project_id: "p2" },
    { id: "p4", name: "Great-grandchild", parent_project_id: "p3" },
  ];

  const result = getDescendantIds(projects, "p1");
  assertEquals(result.length, 3);
  assertEquals(result.includes("p2"), true);
  assertEquals(result.includes("p3"), true);
  assertEquals(result.includes("p4"), true);
});

Deno.test("getDescendantIds - no descendants returns empty", () => {
  const projects: Project[] = [
    { id: "p1", name: "Leaf" },
    { id: "p2", name: "Other" },
  ];

  assertEquals(getDescendantIds(projects, "p1"), []);
});

Deno.test("getDescendantIds - multiple branches", () => {
  const projects: Project[] = [
    { id: "p1", name: "Root" },
    { id: "p2", name: "Branch A", parent_project_id: "p1" },
    { id: "p3", name: "Branch B", parent_project_id: "p1" },
    { id: "p4", name: "Leaf A1", parent_project_id: "p2" },
    { id: "p5", name: "Leaf B1", parent_project_id: "p3" },
  ];

  const result = getDescendantIds(projects, "p1");
  assertEquals(result.length, 4);
  assertEquals(result.includes("p2"), true);
  assertEquals(result.includes("p3"), true);
  assertEquals(result.includes("p4"), true);
  assertEquals(result.includes("p5"), true);
});

Deno.test("getDescendantIds - non-existent project returns empty", () => {
  const projects: Project[] = [{ id: "p1", name: "Exists" }];

  assertEquals(getDescendantIds(projects, "nonexistent"), []);
});

Deno.test("getDescendantIds - does not include the project itself", () => {
  const projects: Project[] = [
    { id: "p1", name: "Root" },
    { id: "p2", name: "Child", parent_project_id: "p1" },
  ];

  const result = getDescendantIds(projects, "p1");
  assertEquals(result.includes("p1"), false);
});

// ---------------------------------------------------------------------------
// hasChildren Tests
// ---------------------------------------------------------------------------

Deno.test("hasChildren - returns true when project has children", () => {
  const projects: Project[] = [
    { id: "p1", name: "Parent" },
    { id: "p2", name: "Child", parent_project_id: "p1" },
  ];

  assertEquals(hasChildren(projects, "p1"), true);
});

Deno.test("hasChildren - returns false when project has no children", () => {
  const projects: Project[] = [
    { id: "p1", name: "Leaf" },
    { id: "p2", name: "Other" },
  ];

  assertEquals(hasChildren(projects, "p1"), false);
});

Deno.test("hasChildren - returns false for non-existent project", () => {
  const projects: Project[] = [{ id: "p1", name: "Exists" }];

  assertEquals(hasChildren(projects, "nonexistent"), false);
});
