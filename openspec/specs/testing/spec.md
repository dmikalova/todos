# Testing

## Purpose

Define the testing strategy and coverage requirements for the tasks app,
covering unit tests, integration tests, and frontend component tests.

## Requirements

## Requirement: 100% test coverage for all source files

Every source file under `src/` SHALL have corresponding tests. Coverage MUST be
measured and enforced via `deno test --coverage`. No untested code paths SHALL
exist after this change.

### Scenario: Coverage report passes 100%

- **WHEN** `deno test --coverage` is run
- **THEN** all source files report 100% line and branch coverage

## Requirement: Window evaluation unit tests

The `context_matching_test.ts` unit tests SHALL cover window active state
evaluation. The existing tests cover the basic cases; the following additional
cases MUST be added.

### Scenario: Multiple days in same window

- **WHEN** a window spans multiple days (e.g., Mon–Fri defined as 5 separate
  windows on the same context)
- **THEN** `isContextActive` returns true for each covered day and false for
  uncovered days

### Scenario: Project context inheritance — nearest ancestor wins

- **WHEN** a project has no contexts but its grandparent has contexts
- **THEN** `resolveEffectiveContexts(project, projects)` returns the
  grandparent's contexts

### Scenario: Project context inheritance — direct assignment beats ancestor

- **WHEN** a project has its own contexts and a parent project also has contexts
- **THEN** `resolveEffectiveContexts` returns the child project's own contexts

### Scenario: No ancestor has contexts

- **WHEN** a project and all ancestors have no contexts
- **THEN** `resolveEffectiveContexts` returns empty array

### Scenario: Task with direct contexts overrides project

- **WHEN** a task has direct context assignments
- **THEN** `resolveTaskContexts(task, project, projects)` returns the task's own
  contexts, ignoring project contexts

### Scenario: Task with no contexts inherits from project

- **WHEN** a task has no direct context assignments
- **THEN** `resolveTaskContexts(task, project, projects)` returns the project's
  effective contexts

## Requirement: Next view pipeline unit tests

A new `tests/unit/next_pipeline_test.ts` file SHALL test the client-side Next
view pipeline in isolation.

### Scenario: Active windows filter to correct contexts

- **WHEN** `getActiveContextIds(contexts, now)` is called with a mix of active
  and inactive windows
- **THEN** only context IDs with at least one active window are returned

### Scenario: Tasks filtered by effective contexts matching active contexts

- **WHEN** `getNextTasks(tasks, projects, activeContextIds)` is called
- **THEN** only tasks whose effective contexts overlap with active context IDs
  are returned

### Scenario: Task with direct context overrides project for Next

- **WHEN** a task has direct context "evening" and project has "work"
- **AND** "evening" is active but "work" is not
- **THEN** the task appears in Next results

### Scenario: Next task list sorted by context rank then task priority

- **WHEN** `sortNextTasks(tasks, activeContexts)` is called
- **THEN** tasks are sorted by highest-rank active context (lowest sort_order),
  then task priority descending, then due date ascending (undated last), then
  title alphabetically

### Scenario: Contextless tasks excluded from Next

- **WHEN** `getNextTasks(tasks)` is called and some tasks have no effective
  contexts
- **THEN** those tasks are excluded from the result

## Requirement: Project task count unit tests

A new `tests/unit/project_task_count_test.ts` file SHALL test the open-task
count logic.

### Scenario: Count excludes completed tasks

- **WHEN** `getOpenTaskCount(tasks, projectId)` is called with a mix of
  completed and open tasks
- **THEN** only open (non-completed) tasks for the project are counted

### Scenario: Count is zero when all tasks are done

- **WHEN** all tasks for a project have `completed_at` set
- **THEN** `getOpenTaskCount` returns 0

## Requirement: Task loading unit tests

A new `tests/unit/task_loading_test.ts` file SHALL test the initial load and
infinite scroll logic.

### Scenario: Initial load fetches all open tasks and 100 completed

- **WHEN** `buildInitialLoadParams()` is called
- **THEN** it returns params for fetching all open tasks and
  `{ completed: true, limit: 100, orderBy: 'completed_at desc' }`

### Scenario: Infinite scroll offset advances correctly

- **WHEN** `getNextHistoryPage(currentOffset, pageSize)` is called
- **THEN** it returns `currentOffset + pageSize`

## Requirement: Context CRUD integration tests

`tests/integration/context_test.ts` SHALL test all context API endpoints.

### Scenario: POST /api/contexts creates context with windows

- **WHEN** a POST is made with
  `{ name, color, timeWindows: [{ dayOfWeek, startTime, endTime }] }`
- **THEN** the response is 201 with the context and windows
- **AND** a subsequent GET returns the same windows

### Scenario: PATCH /api/contexts/:id replaces windows

- **WHEN** a PATCH is made with a new `timeWindows` array
- **THEN** the old windows are removed and the new ones are stored

### Scenario: DELETE /api/contexts/:id removes context and windows

- **WHEN** DELETE is called on a context
- **THEN** the context and all its windows are removed
- **AND** any project `context_id` references are nullified or cascade-handled

### Scenario: GET /api/contexts returns all contexts with windows

- **WHEN** GET /api/contexts is called
- **THEN** each context in the response includes its `time_windows` array

## Requirement: Project CRUD integration tests

`tests/integration/project_test.ts` SHALL test all project API endpoints
including context and nesting.

### Scenario: POST /api/projects creates project with contexts

- **WHEN** a POST is made with `{ name, contextIds: [...] }`
- **THEN** the response is 201 with the project including its contexts

### Scenario: PATCH /api/projects/:id updates contexts

- **WHEN** a PATCH sets new `contextIds`
- **THEN** the project's context associations are replaced

### Scenario: GET /api/projects/:id task_count excludes completed tasks

- **WHEN** a project has open and completed tasks
- **THEN** `task_count` in the response equals only the open task count

### Scenario: Nested project stores parent_project_id

- **WHEN** a project is created with `parentProjectId`
- **THEN** the response includes the correct `parent_project_id`

## Requirement: Task integration tests

`tests/integration/task_test.ts` SHALL include tests for task filtering and
pagination.

### Scenario: GET /api/tasks?completed=false excludes completed tasks

- **WHEN** GET /api/tasks?completed=false is called
- **THEN** all returned tasks have `completed_at: null`

### Scenario: GET /api/tasks?completed=true with limit=100 for history

- **WHEN** GET /api/tasks?completed=true&limit=100&offset=0 is called
- **THEN** at most 100 completed tasks are returned ordered by
  `completed_at desc`

## Requirement: Next integration tests reflect context inheritance

`tests/integration/next_test.ts` SHALL test that effective contexts (CSS-style
cascade) drive Next visibility.

### Scenario: Next returns tasks inheriting project context

- **WHEN** a project has contexts with an active time window, and tasks belong
  to that project with no direct contexts
- **THEN** GET /api/next returns those tasks

### Scenario: Next returns tasks with direct context overriding project

- **WHEN** a task has direct context "evening" (active) and project has "work"
  (inactive)
- **THEN** GET /api/next returns that task

### Scenario: Next excludes tasks with all effective contexts inactive

- **WHEN** a task's effective contexts (direct or inherited) are all inactive
- **THEN** that task does not appear in GET /api/next

### Scenario: Next excludes contextless tasks

- **WHEN** tasks have no effective contexts (no direct, no inherited)
- **THEN** GET /api/next does not include them

## Requirement: Store unit tests

A new `tests/unit/store_test.ts` SHALL test the `Store` class logic (pure
computed properties only — no fetch mocking required for unit tests).

### Scenario: inboxTasks excludes completed tasks by default

- **WHEN** `store._taskFilter` is `{ completed: "false" }` and tasks include
  completed and open tasks with no project
- **THEN** `store.inboxTasks` returns only open, project-less tasks

### Scenario: inboxCount reflects only open inbox tasks

- **WHEN** the task list contains completed inbox tasks
- **THEN** `store.inboxCount` does not count them

### Scenario: projectTasks filters by selected project and completion filter

- **WHEN** `_selectedProjectId` is set and `_taskFilter.completed` is "false"
- **THEN** `store.projectTasks` returns only open tasks for that project

### Scenario: dueTasks sorted ascending by due date

- **WHEN** tasks have various due dates
- **THEN** `store.dueTasks` is sorted by due date ascending with no completed
  tasks

### Scenario: currentPageTitle returns correct label for each tab

- **WHEN** `_currentTab` is set to each valid tab value
- **THEN** `store.currentPageTitle` returns the expected label

## Requirement: Sidebar component tests

Frontend tests for `todo-sidebar.ts` SHALL verify the lowercase label tenet.

### Scenario: All sidebar labels are lowercase

- **WHEN** the sidebar component renders
- **THEN** every visible nav label text is fully lowercase (no uppercase
  characters)

### Scenario: Labels sourced from constants, not hardcoded

- **WHEN** the sidebar source is statically analyzed
- **THEN** no label string is hardcoded inline — all come from the
  constants/i18n module

## Requirement: Context selector component tests

Frontend tests for the context selector in `project-form.ts` SHALL verify
correct load and submit behavior.

### Scenario: Context multi-select pre-populates on edit

- **WHEN** the form is opened with an existing project that has contexts
- **THEN** the multi-select shows those contexts as selected

### Scenario: Context multi-select submits correct IDs

- **WHEN** the user selects multiple contexts and submits
- **THEN** the submitted payload includes the correct `contextIds` array

## Requirement: History view infinite scroll tests

Frontend tests for `history-view.ts` SHALL verify infinite scroll behavior.

### Scenario: Scroll to bottom triggers load more

- **WHEN** the user scrolls to the bottom of the history list
- **THEN** a fetch for the next page of completed tasks is triggered

### Scenario: No more fetches after list exhausted

- **WHEN** the last fetch returned fewer items than the page size
- **THEN** subsequent scroll events do not trigger additional fetches

## Requirement: Project nesting unit tests

Unit tests SHALL cover the store's tree computation, descendant calculation, and
collapse state logic.

### Scenario: projectTree computes correct depths

- **WHEN** `projectTree` is called with nested projects
- **THEN** each entry has the correct depth value matching its nesting level

### Scenario: projectTree orders children after parent

- **WHEN** `projectTree` is called with parent and child projects
- **THEN** children appear immediately after their parent in the output

### Scenario: getDescendantIds returns all recursive descendants

- **WHEN** `getDescendantIds(projectId)` is called
- **THEN** it returns all recursive descendant project IDs

### Scenario: Collapse state filters tree correctly

- **WHEN** `projectTree` is called with collapsed parent IDs
- **THEN** children of collapsed parents are excluded from the output

### Scenario: Alphabetical ordering within siblings

- **WHEN** siblings exist with different names
- **THEN** `projectTree` orders them alphabetically by name

## Requirement: Project nesting integration tests

Integration tests SHALL cover the nested project API behavior.

### Scenario: Create nested project via API

- **WHEN** POST /api/projects is called with `parentProjectId`
- **THEN** the response includes the correct `parent_project_id`

### Scenario: Update parent prevents circular reference

- **WHEN** PATCH /api/projects/:id sets `parentProjectId` to a descendant
- **THEN** the API returns 400 Bad Request

### Scenario: Delete parent orphans children

- **WHEN** a parent project is deleted
- **THEN** child projects have `parent_project_id` set to null
