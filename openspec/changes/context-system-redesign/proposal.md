# Context System Redesign: Proposal

## Why

The current context system has conflicting specs and a half-implemented data
model. The `contexts` spec says tasks can have multiple contexts, but the
`todo-context-assignment` spec says tasks SHALL NOT have a `context_id` field.
The schema has a single `context_id` FK on projects with no task-level context
support.

The goal of contexts is to surface the right tasks at the right time — e.g.,
weekday after work, weekend, tuesday night cleanup, work hours. The current
model can't express cases like:

- A task in a "chores" project that belongs to a specific context different from
  the project's context
- A task that should appear in multiple time windows (e.g., "tuesday cleanup"
  AND "weekend")
- Context priority ordering when multiple contexts are active simultaneously

Additionally, `must_do` is unused and should be removed to simplify the system.

## What Changes

- **Multi-context on projects**: Replace single `context_id` FK with a
  `project_contexts` join table supporting multiple contexts per project
- **Multi-context on tasks**: Add a `task_contexts` join table so tasks can
  optionally have their own contexts that override inherited project contexts
- **CSS-style inheritance**: Tasks inherit contexts from their project hierarchy
  (nearest ancestor with contexts wins). Tasks with their own contexts override
  inheritance entirely (most-specific-wins)
- **Context rank**: Use existing `sort_order` on contexts as a positional rank
  (sidebar order = rank). When multiple contexts are active, highest-rank
  context's tasks are presented first in Next. Rank is managed by reordering in
  the sidebar or up/down controls in the context editor
- **Context as navigation view**: Clicking a context shows all tasks with that
  effective context, similar to project/filter presentation with edit and
  done/all/next controls
- **Remove `must_do`**: Drop the `must_do` column from tasks and remove all
  references from specs, scoring, and UI
- **Empty Next state**: When all tasks in active contexts are done/deferred,
  Next shows empty rather than falling back to other contexts

## Capabilities

### New Capabilities

- `context-multi-assignment`: Projects and tasks support zero or more contexts
  via join tables. CSS-style cascade: task contexts > project contexts >
  ancestor project contexts
- `context-navigation-view`: Contexts are clickable navigation items showing all
  tasks with that effective context, with edit/done/all/next controls

### Modified Capabilities

- `contexts`: Updated to reflect multi-context per entity, CSS-style
  inheritance, context priority, and removal of "always eligible" semantics for
  contextless tasks
- `todo-context-assignment`: Rewritten — projects and tasks both support
  multi-context via join tables; CSS cascade inheritance
- `next-view`: Updated pipeline to resolve effective contexts per task (not just
  per project), sort by context priority, and show empty state when done
- `next-page`: Removed `must_do` scoring bonus and "must_do cannot be deferred"
  requirement; scoring is now `priority_weight + overdue_days`
- `task-management`: Removed `must_do` from task creation fields; contexts are
  now a multi-select on the task form (optional override)
- `testing`: Updated to test multi-context resolution, CSS cascade, and context
  priority sorting

### Removed Capabilities

- `must-do`: The `must_do` boolean on tasks is removed from schema, API, and UI.
  Priority system handles urgency instead

## Impact

- **Schema**: Drop `must_do` column from tasks. Drop `context_id` FK from
  projects. Add `project_contexts` join table (`project_id`, `context_id`). Add
  `task_contexts` join table (`task_id`, `context_id`)
- **Backend**: Update task CRUD to handle `contextIds` array. Update project
  CRUD to handle `contextIds` array. Update next endpoint to resolve effective
  contexts per task
- **Frontend**: Update task form (optional multi-select context picker with
  inheritance hint). Update project form (multi-select context picker). Add
  context navigation view. Update Next pipeline for CSS cascade resolution and
  context priority sorting. Remove `must_do` toggle from task form
- **Tests**: Update unit tests for multi-context resolution. Update integration
  tests for new join table API. Remove `must_do` test coverage

## Compatibility Notes

The Next system will be redesigned separately in a future change. This context
redesign ensures compatibility by:

- Keeping context time windows as the mechanism for "active" detection
- Supporting defer (tasks deferred within a context respect context activation)
- Keeping context priority for ordering in Next
- Not coupling context resolution to any specific Next algorithm
