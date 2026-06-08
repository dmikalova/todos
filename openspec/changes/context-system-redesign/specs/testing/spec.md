## MODIFIED Requirements

### Requirement: Window evaluation unit tests

The `context_matching_test.ts` unit tests SHALL cover window active state
evaluation and the new multi-context cascade resolution.

#### Scenario: Multiple days in same window

- **WHEN** a window spans multiple days (e.g., Mon-Fri as 5 separate windows)
- **THEN** `isContextActive` returns true for each covered day

#### Scenario: Project context inheritance — nearest ancestor wins

- **WHEN** a project has no contexts but its grandparent does
- **THEN** `resolveEffectiveContexts(project, projects)` returns grandparent's
  contexts

#### Scenario: Project context inheritance — direct beats ancestor

- **WHEN** a project has its own contexts and parent also has contexts
- **THEN** `resolveEffectiveContexts` returns the project's own contexts

#### Scenario: No ancestor has contexts

- **WHEN** a project and all ancestors have no contexts
- **THEN** `resolveEffectiveContexts` returns empty array

#### Scenario: Task with direct contexts overrides project

- **WHEN** a task has entries in `task_contexts`
- **THEN** `resolveTaskContexts(task, ...)` returns the task's own contexts

#### Scenario: Task with no contexts inherits from project

- **WHEN** a task has no `task_contexts` entries
- **THEN** `resolveTaskContexts(task, ...)` returns the project's effective
  contexts

### Requirement: Next view pipeline unit tests

A `tests/unit/next_pipeline_test.ts` file SHALL test the client-side Next view
pipeline with multi-context resolution.

#### Scenario: Active windows filter to correct contexts

- **WHEN** `getActiveContextIds(contexts, now)` is called
- **THEN** only context IDs with at least one active window are returned

#### Scenario: Tasks filtered by effective contexts

- **WHEN**
  `getNextTasks(tasks, projects, projectContexts, taskContexts, activeIds)` is
  called
- **THEN** only tasks with effective contexts overlapping active IDs are
  returned

#### Scenario: Task direct context override in Next

- **WHEN** a task has direct context "evening" (active) and project has "work"
  (inactive)
- **THEN** the task appears in Next results

#### Scenario: Next sorted by context rank then task priority

- **WHEN** `sortNextTasks(tasks, activeContexts)` is called
- **THEN** tasks sorted by context sort_order ascending (rank), then task
  priority descending, then due date ascending (undated last), then title
  alphabetically

#### Scenario: Contextless tasks excluded from Next

- **WHEN** tasks have no effective contexts
- **THEN** those tasks are excluded from Next results
