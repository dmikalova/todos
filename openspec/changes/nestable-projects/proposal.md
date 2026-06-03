# Nestable Projects: Proposal

## Why

The backend and data model already support project nesting (`parent_project_id`
on projects, `resolveProjectContext` for inheritance), but the frontend has no
UI for it — projects render as a flat list with no way to set or view
parent/child relationships. At the same time, test coverage sits at 65.6% branch
/ 52.2% line, well below the 100% target.

## What Changes

- Add parent project selector to the project form so users can nest projects
  under other projects
- Display projects as a collapsible indented tree in the sidebar, with visual
  hierarchy and expand/collapse toggles on parent projects
- Support drag-and-drop to re-parent projects by dragging onto another project
  (sibling order is always alphabetical by name)
- Ensure child projects inherit context from their nearest ancestor when no
  context is explicitly set (already works in store logic — needs UI visibility)
- Increase test coverage to 100% line and branch across all `src/` files

## Capabilities

### New Capabilities

- `project-nesting-ui`: Frontend UI for creating, editing, and displaying nested
  projects — parent selector in project form, tree rendering in sidebar

### Modified Capabilities

- `todo-context-assignment`: Add requirement that the project form shows
  inherited context (read-only) when no direct context is set, so users
  understand the inheritance
- `testing`: Update coverage requirements — all `src/` files must reach 100%
  line and branch coverage, covering the new nesting UI and all existing gaps

## Impact

- Schema: No changes needed — `parent_project_id` column and FK already exist
- Backend: No new endpoints — existing PATCH /api/projects/:id already handles
  `parentProjectId` updates
- Frontend: `project-form.ts` (parent selector), `todo-sidebar.ts` (tree
  rendering with collapse/expand and drag-and-drop), `store.ts` (tree
  computation helpers, collapsed state)
- Tests: new unit tests for tree building, new integration tests for nested
  project CRUD, coverage gap-filling across all low-coverage `src/` files
  (`middleware.ts`, `routes/contexts.ts`, `routes/projects.ts`,
  `routes/recurrence.ts`, `routes/tasks.ts`, `routes/export.ts`,
  `routes/filters.ts`, `routes/history.ts`, `routes/import.ts`,
  `services/history.ts`, `services/ownership.ts`, `services/recurrence.ts`)
- No schema changes — `parent_project_id` column and FK already exist
- No new backend endpoints — existing PATCH already handles `parentProjectId`
