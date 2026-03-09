# Why

The todos app has several bugs preventing MVP usability: context assignment is
broken, the "Next" view does not pull from contexts, and windows (time-based
filters within contexts) are untested. The UI also lacks consistent labeling
conventions, reducing polish and trust.

## What Changes

- Project task count displays only open (incomplete) tasks — done tasks are
  excluded from the count
- Task loading is bounded: all open tasks load fully; closed/done tasks load as
  a capped history (limit: 100, ordered by completion date descending)
- Contexts are named, reusable labels (e.g., "morning", "evening", "free time")
  shared across projects
- Windows are recurring schedules on a context (e.g., Mon–Fri 9–12), evaluated
  client-side
- Nested projects inherit the nearest ancestor's context if none is explicitly
  set
- Wire the "Next" view to use the pipeline: active windows → contexts → projects
  → tasks
- Add ownership validation: shared `assertOwnership` helper; all resource ID
  inputs (contextId, projectId, parentProjectId) verified against authenticated
  user before use
- Enforce lowercase UI labels across the sidebar and establish this as a project
  tenet

## Capabilities

### New Capabilities

- `todo-context-assignment`: Context is set on projects (not tasks); tasks
  inherit via project; nested project inheritance; project task count shows only
  open tasks
- `resource-ownership`: Shared `assertOwnership` helper validates all submitted
  resource IDs against the authenticated user; foreign IDs return 403
- `ui-label-conventions`: Project tenet — all sidebar and navigation labels use
  lowercase
- `todo-windows`: Recurring window schedules on contexts, evaluated client-side
  using local time
- `next-view`: The "Next" view surfaces tasks via active windows → contexts →
  projects pipeline
- `testing`: 100% coverage target; new unit tests for window evaluation, Next
  pipeline, project context inheritance, task loading, and store logic; updated
  integration tests for contexts/projects/tasks/next; frontend component tests
  for sidebar labels, context selector, and history infinite scroll

### Modified Capabilities

<!-- None — no existing specs to delta against -->

## Impact

- Schema: remove `context_id` from tasks; ensure `context_id` and
  `parent_project_id` on projects
- Backend: project CRUD (context field), context/window CRUD, Next query
- Frontend: project form (context selector), sidebar label components, Next view
  component, window evaluation logic
- Tests: new backend unit/integration tests for projects + contexts + windows;
  new frontend component tests for project form, sidebar, and Next view
