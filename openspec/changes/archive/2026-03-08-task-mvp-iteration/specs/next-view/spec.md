# ADDED Requirements

## Requirement: Next view shows tasks from active contexts

The Next view SHALL display incomplete tasks whose project (or nearest ancestor
project) is assigned to a context with at least one currently active window.
Tasks whose project has no effective context MUST NOT appear in Next.

### Scenario: Task in project with active context appears in Next

- **WHEN** a task's project is assigned to a context that has an active window
- **THEN** that task appears in the Next view

### Scenario: Task in project with inactive context does not appear in Next

- **WHEN** a task's project is assigned only to contexts with no active windows
- **THEN** that task does not appear in the Next view

### Scenario: Task in project with no context does not appear in Next

- **WHEN** a task's project has no context set and no ancestor project has a
  context
- **THEN** that task does not appear in the Next view

### Scenario: Inbox tasks (no project) do not appear in Next

- **WHEN** a task has no project assigned
- **THEN** that task does not appear in the Next view and is only visible in the
  inbox

### Scenario: Task inherits context through nested project

- **WHEN** a task's immediate project has no context but an ancestor project
  does, and that context has an active window
- **THEN** the task appears in the Next view

## Requirement: Next view pipeline is client-side

The Next view SHALL compute its task list client-side using the following
pipeline:

1. Evaluate all windows against device local time → collect IDs of active
   contexts
2. Find all projects assigned to (or inheriting) an active context
3. Return incomplete tasks belonging to those projects

### Scenario: Next view computes locally from realtime data

- **WHEN** the frontend loads the Next view
- **THEN** it evaluates active windows from the locally-held context/window data
  (kept fresh via Supabase realtime)
- **AND** filters tasks client-side without an additional backend request

## Requirement: Next view ordering

Tasks in the Next view SHALL be ordered by due date ascending (earliest first),
with undated tasks appearing last.

### Scenario: Tasks with due dates appear before undated tasks

- **WHEN** the Next view contains both dated and undated tasks
- **THEN** dated tasks appear first, sorted by due date ascending
- **AND** undated tasks appear after all dated tasks
