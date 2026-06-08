// Unit tests for context selector pre-population logic
// Tests the project form initialization behavior with multi-select contexts

import { assertEquals } from "@std/assert";

interface Project {
  id: string;
  name: string;
  color?: string;
  context_ids: string[];
}

// Pure function equivalent of ProjectForm.connectedCallback initialization
function initProjectForm(editingProject: Project | null) {
  if (editingProject) {
    return {
      name: editingProject.name,
      color: editingProject.color || "#4caf50",
      context_ids: editingProject.context_ids || [],
    };
  }
  return {
    name: "",
    color: "#4caf50",
    context_ids: [] as string[],
  };
}

// ---------------------------------------------------------------------------
// Pre-population Tests
// ---------------------------------------------------------------------------

Deno.test(
  "context selector - pre-populates context_ids from editing project",
  () => {
    const project: Project = {
      id: "p1",
      name: "Work",
      context_ids: ["ctx-1", "ctx-2"],
    };

    const form = initProjectForm(project);
    assertEquals(form.context_ids, ["ctx-1", "ctx-2"]);
    assertEquals(form.name, "Work");
  },
);

Deno.test(
  "context selector - empty context_ids when editing project has no contexts",
  () => {
    const project: Project = {
      id: "p1",
      name: "Inbox Project",
      context_ids: [],
    };

    const form = initProjectForm(project);
    assertEquals(form.context_ids, []);
  },
);

Deno.test("context selector - empty form when not editing", () => {
  const form = initProjectForm(null);
  assertEquals(form.name, "");
  assertEquals(form.color, "#4caf50");
  assertEquals(form.context_ids, []);
});

Deno.test("context selector - preserves project name and color on edit", () => {
  const project: Project = {
    id: "p1",
    name: "My Project",
    color: "#ff5722",
    context_ids: ["ctx-2"],
  };

  const form = initProjectForm(project);
  assertEquals(form.name, "My Project");
  assertEquals(form.color, "#ff5722");
  assertEquals(form.context_ids, ["ctx-2"]);
});

Deno.test(
  "context selector - uses default color when editing project has no color",
  () => {
    const project: Project = {
      id: "p1",
      name: "Plain Project",
      context_ids: ["ctx-1"],
    };

    const form = initProjectForm(project);
    assertEquals(form.color, "#4caf50");
  },
);
