# ADDED Requirements

## Requirement: 100% test coverage for all source files

Every source file under `src/` SHALL have corresponding tests. Coverage MUST be
measured and enforced via `deno test --coverage`. No untested code paths SHALL
exist after this change.

### Scenario: Coverage report passes 100%

- **WHEN** `deno test --coverage` is run
- **THEN** all source files report 100% line and branch coverage

---

## ADDED Requirements — Unit Tests (`tests/unit/`)

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

- **WHEN** a project has no context but its grandparent has one
- **THEN** `resolveProjectContext(project, projects)` returns the grandparent's
  context

### Scenario: Project context inheritance — direct assignment beats ancestor

- **WHEN** a project has its own context and a parent project also has a context
- **THEN** `resolveProjectContext` returns the child project's own context

### Scenario: No ancestor has a context

- **WHEN** a project and all ancestors have no context
- **THEN** `resolveProjectContext` returns null

## Requirement: Next view pipeline unit tests

A new `tests/unit/next_pipeline_test.ts` file SHALL test the client-side Next
view pipeline in isolation.

### Scenario: Active windows filter to correct contexts

- **WHEN** `getActiveContextIds(contexts, now)` is called with a mix of active
  and inactive windows
- **THEN** only context IDs with at least one active window are returned

### Scenario: Projects filtered by active context IDs

- **WHEN** `getNextProjects(projects, activeContextIds)` is called
- **THEN** only projects whose effective context is in `activeContextIds` are
  returned

### Scenario: Inherited context counts for project filtering

- **WHEN** a project has no direct context but its parent's context is active
- **THEN** the project is included in `getNextProjects` results

### Scenario: Next task list sorted by due date

- **WHEN** `sortNextTasks(tasks)` is called with mixed dated/undated tasks
- **THEN** tasks are returned sorted by due date ascending, undated tasks last

### Scenario: Inbox tasks excluded from Next

- **WHEN** `filterNextTasks(tasks)` is called and some tasks have no
  `project_id`
- **THEN** tasks without a project are excluded from the result

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

---

## ADDED Requirements — Integration Tests (`tests/integration/`)

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

### Scenario: POST /api/projects creates project with context_id

- **WHEN** a POST is made with `{ name, contextId }`
- **THEN** the response is 201 with the project including `context_id`

### Scenario: PATCH /api/projects/:id updates context_id

- **WHEN** a PATCH sets a new `contextId`
- **THEN** the project's `context_id` is updated

### Scenario: GET /api/projects/:id task_count excludes completed tasks

- **WHEN** a project has open and completed tasks
- **THEN** `task_count` in the response equals only the open task count

### Scenario: Nested project stores parent_project_id

- **WHEN** a project is created with `parentProjectId`
- **THEN** the response includes the correct `parent_project_id`

## Requirement: Task integration tests cover context round-trip

`tests/integration/task_test.ts` SHALL include tests for the context assignment
round-trip.

### Scenario: Create task with contextIds saves correctly

- **WHEN** POST /api/tasks is called with `contextIds: [id1, id2]`
- **THEN** GET /api/tasks/:id returns `context_ids: [id1, id2]`

### Scenario: PATCH task with new contextIds replaces old ones

- **WHEN** PATCH /api/tasks/:id is called with `contextIds: [id3]`
- **THEN** GET /api/tasks/:id returns `context_ids: [id3]` (previous IDs
  removed)

### Scenario: PATCH task with empty contextIds clears all contexts

- **WHEN** PATCH /api/tasks/:id is called with `contextIds: []`
- **THEN** GET /api/tasks/:id returns `context_ids: []`

### Scenario: GET /api/tasks?completed=false excludes completed tasks

- **WHEN** GET /api/tasks?completed=false is called
- **THEN** all returned tasks have `completed_at: null`

### Scenario: GET /api/tasks?completed=true with limit=100 for history

- **WHEN** GET /api/tasks?completed=true&limit=100&offset=0 is called
- **THEN** at most 100 completed tasks are returned ordered by
  `completed_at desc`

## Requirement: Next integration tests reflect project-based context

`tests/integration/next_test.ts` SHALL be updated to reflect that contexts are
now on projects, not tasks.

### Scenario: Next returns tasks from projects with active context

- **WHEN** a project is assigned a context with an active time window, and tasks
  belong to that project
- **THEN** GET /api/next returns those tasks

### Scenario: Next excludes tasks from projects with inactive context

- **WHEN** a project's context has no active window at the test time
- **THEN** those tasks do not appear in GET /api/next

### Scenario: Next excludes inbox tasks (no project)

- **WHEN** tasks exist with no `project_id`
- **THEN** GET /api/next does not include them

---

## ADDED Requirements — Frontend Component Tests

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

### Scenario: Context selector pre-populates on edit

- **WHEN** the form is opened with an existing project that has a `context_id`
- **THEN** the selector shows that context as selected

### Scenario: Context selector submits correct ID

- **WHEN** the user selects a context and submits
- **THEN** the submitted payload includes the correct `contextId`

## Requirement: History view infinite scroll tests

Frontend tests for `history-view.ts` SHALL verify infinite scroll behavior.

### Scenario: Scroll to bottom triggers load more

- **WHEN** the user scrolls to the bottom of the history list
- **THEN** a fetch for the next page of completed tasks is triggered

### Scenario: No more fetches after list exhausted

- **WHEN** the last fetch returned fewer items than the page size
- **THEN** subsequent scroll events do not trigger additional fetches
