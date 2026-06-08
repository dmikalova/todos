# Next View

## Purpose

The Next view surfaces tasks the user can act on right now based on active
time-based contexts. It uses a client-side pipeline to evaluate windows, resolve
effective contexts through inheritance, and display relevant tasks ordered by
context priority.

## Requirements

## Requirement: Next view shows tasks from active contexts

The Next view SHALL display incomplete tasks whose effective contexts (direct or
inherited) include at least one currently active context. Tasks with no
effective contexts (contextless) do not appear in Next.

### Scenario: Task in project with active context appears in Next

- **WHEN** a task inherits context "work" from its project and "work" is active
- **THEN** that task appears in the Next view

### Scenario: Task with direct context overriding project appears in Next

- **WHEN** a task has direct context "evening" (overriding project's "work") and
  "evening" is active
- **THEN** that task appears in the Next view

### Scenario: Task in project with inactive context does not appear in Next

- **WHEN** a task's effective contexts are all inactive
- **THEN** that task does not appear in the Next view

### Scenario: Task with no effective context does not appear in Next

- **WHEN** a task has no direct contexts and its project (and ancestors) have no
  contexts
- **THEN** that task does not appear in the Next view

### Scenario: Inbox tasks (no project) do not appear in Next

- **WHEN** a task has no project assigned and no direct contexts
- **THEN** that task does not appear in the Next view

### Scenario: Task with direct context and no project appears in Next

- **WHEN** a task has no project but has direct context "weekend" and "weekend"
  is active
- **THEN** that task appears in the Next view

### Scenario: Task inherits context through nested project

- **WHEN** a task's immediate project has no contexts but an ancestor project
  does, and that context is active
- **THEN** the task appears in the Next view

## Requirement: Next view pipeline is client-side

The Next view SHALL compute its task list client-side using the following
pipeline:

1. Evaluate all context time windows against device local time → collect IDs of
   active contexts
2. For each task, resolve effective contexts (direct > project > ancestor)
3. Include task if any of its effective contexts are in the active set
4. Order by context rank, then task priority, then due date, then title

### Scenario: Next view computes locally from realtime data

- **WHEN** the frontend loads the Next view
- **THEN** it evaluates active windows from the locally-held context/window data
- **AND** resolves effective contexts per task client-side

## Requirement: Next view ordering by context rank

Tasks in the Next view SHALL be ordered first by context rank (lowest sort_order
= highest rank among the task's active effective contexts), then by task
priority descending, then by due date ascending (undated last), then by title
alphabetically.

Context rank is separate from task priority (1-3). Rank determines which
context's tasks appear first; task priority determines order within that group.

### Scenario: Higher-rank context tasks appear first

- **WHEN** "work" (rank 1) and "evening" (rank 3) are both active
- **THEN** work tasks appear before evening tasks

### Scenario: Within same context rank, higher task priority first

- **WHEN** two tasks share the same effective context
- **THEN** higher-priority tasks appear before lower-priority tasks

### Scenario: Tasks with due dates appear before undated tasks

- **WHEN** tasks within the same context and priority have mixed due dates
- **THEN** dated tasks appear first, sorted by due date ascending
- **AND** undated tasks appear after all dated tasks

### Scenario: Alphabetical tiebreaker

- **WHEN** tasks have same context rank, priority, and due date
- **THEN** tasks are sorted alphabetically by title

### Scenario: Task in multiple active contexts uses highest rank

- **WHEN** a task has effective contexts "work" (rank 1) and "evening" (rank 3)
- **AND** both are active
- **THEN** the task is sorted by rank 1 (its highest-rank active context)

## Requirement: Empty Next state

When no tasks match the active context criteria (all done, all deferred, or no
tasks exist in those contexts), the Next view SHALL show an empty state.

### Scenario: All context tasks completed

- **WHEN** all tasks in active contexts are completed or deferred
- **THEN** Next view shows an empty state
