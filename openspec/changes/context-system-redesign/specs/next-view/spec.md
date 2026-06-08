# Next View

## MODIFIED Requirements

### Requirement: Next view shows tasks from active contexts

The Next view SHALL display incomplete tasks whose effective contexts (resolved
via CSS cascade: task > project > ancestor) include at least one currently
active context. Contextless tasks do not appear in Next.

#### Scenario: Task inheriting project context appears in Next

- **WHEN** a task inherits context "work" from its project and "work" is active
- **THEN** that task appears in the Next view

#### Scenario: Task with direct context override appears in Next

- **WHEN** a task has direct context "evening" (overriding project's "work") and
  "evening" is active
- **THEN** that task appears in the Next view

#### Scenario: Task with all effective contexts inactive excluded

- **WHEN** a task's effective contexts are all inactive
- **THEN** that task does not appear in the Next view

#### Scenario: Contextless task excluded from Next

- **WHEN** a task has no effective contexts (no direct, no inherited)
- **THEN** that task does not appear in the Next view

#### Scenario: Task with direct context and no project appears in Next

- **WHEN** a task has no project but has direct context "weekend" and "weekend"
  is active
- **THEN** that task appears in the Next view

### Requirement: Next view pipeline is client-side

The Next view SHALL compute its task list client-side using the following
pipeline:

1. Evaluate all context time windows against device local time → active context
   IDs
2. For each task, resolve effective contexts via CSS cascade
3. Include task if any effective context is in the active set
4. Order by context rank, then task priority, then due date, then title

#### Scenario: Next view computes locally

- **WHEN** the frontend loads the Next view
- **THEN** it resolves effective contexts per task and filters by active
  contexts client-side

### Requirement: Next view ordering by context rank

Tasks in the Next view SHALL be ordered first by context rank (lowest sort_order
= highest rank among the task's active effective contexts), then by task
priority descending, then by due date ascending (undated last), then by title
alphabetically.

Context rank is separate from task priority (1-3). Rank determines which
context's tasks appear first; task priority determines order within that group.

#### Scenario: Higher-rank context tasks appear first

- **WHEN** "work" (rank 1) and "evening" (rank 3) are both active
- **THEN** work-context tasks appear before evening-context tasks

#### Scenario: Within same context rank, task priority wins

- **WHEN** two tasks share the same effective context
- **THEN** higher task priority (p1 > p2 > p3) appears first

#### Scenario: Due date tiebreaker

- **WHEN** tasks have same context rank and task priority
- **THEN** earlier due dates first, undated last

#### Scenario: Alphabetical tiebreaker

- **WHEN** tasks have same context rank, priority, and due date
- **THEN** tasks are sorted alphabetically by title

#### Scenario: Task in multiple active contexts uses highest rank

- **WHEN** a task has effective contexts "work" (rank 1) and "evening" (rank 3)
- **AND** both are active
- **THEN** the task is sorted by rank 1 (its highest-rank active context)

### Requirement: Empty Next state

When no tasks match the active context criteria, the Next view SHALL show an
empty state. It SHALL NOT fall back to other contexts.

#### Scenario: All context tasks completed

- **WHEN** all tasks in active contexts are completed or deferred
- **THEN** Next view shows an empty state
