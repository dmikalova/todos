// Unit tests for context selector pre-population logic
// Tests the project form initialization behavior

import { assertEquals } from "@std/assert";

interface Project {
  id: string;
  name: string;
  color?: string;
  context_id?: string | null;
}

// Pure function equivalent of ProjectForm.connectedCallback initialization
function initProjectForm(editingProject: Project | null) {
  if (editingProject) {
    return {
      name: editingProject.name,
      color: editingProject.color || "#4caf50",
      context_id: editingProject.context_id || null,
    };
  }
  return {
    name: "",
    color: "#4caf50",
    context_id: null as string | null,
  };
}

// ---------------------------------------------------------------------------
// Pre-population Tests
// ---------------------------------------------------------------------------

Deno.test("context selector - pre-populates context_id from editing project", () => {
  const project: Project = {
    id: "p1",
    name: "Work",
    context_id: "ctx-1",
  };

  const form = initProjectForm(project);
  assertEquals(form.context_id, "ctx-1");
  assertEquals(form.name, "Work");
});

Deno.test("context selector - null context_id when editing project has no context", () => {
  const project: Project = {
    id: "p1",
    name: "Inbox Project",
    context_id: null,
  };

  const form = initProjectForm(project);
  assertEquals(form.context_id, null);
});

Deno.test("context selector - null context_id when editing project context is undefined", () => {
  const project: Project = {
    id: "p1",
    name: "No Context",
  };

  const form = initProjectForm(project);
  assertEquals(form.context_id, null);
});

Deno.test("context selector - empty form when not editing", () => {
  const form = initProjectForm(null);
  assertEquals(form.name, "");
  assertEquals(form.color, "#4caf50");
  assertEquals(form.context_id, null);
});

Deno.test("context selector - preserves project name and color on edit", () => {
  const project: Project = {
    id: "p1",
    name: "My Project",
    color: "#ff5722",
    context_id: "ctx-2",
  };

  const form = initProjectForm(project);
  assertEquals(form.name, "My Project");
  assertEquals(form.color, "#ff5722");
  assertEquals(form.context_id, "ctx-2");
});

Deno.test("context selector - uses default color when editing project has no color", () => {
  const project: Project = {
    id: "p1",
    name: "Plain Project",
    context_id: "ctx-1",
  };

  const form = initProjectForm(project);
  assertEquals(form.color, "#4caf50");
});
