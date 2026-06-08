# Next Page

## MODIFIED Requirements

### Requirement: Smart task selection

The system SHALL select tasks for the "Next" page by priority grouping with
random selection within each group. Due date does NOT affect task selection.

Selection criteria:

1. Eligible tasks: `completed_at IS NULL` AND `deleted_at IS NULL`
2. Context filter: at least one of the task's effective contexts is currently
   active
3. Deferred filter: `deferred_until IS NULL` OR `deferred_until <= NOW()`

Selection algorithm:

1. Group eligible tasks by priority (p1 > p2 > p3)
2. Select from the highest-priority group that has tasks
3. Within that group, randomly pick one task

Randomization only occurs when choosing a NEW task (after the current task is
completed or deferred). Due date is informational metadata only — it does not
influence which task is selected next.

#### Scenario: High priority selected over overdue low priority

- **WHEN** a p1 task exists alongside a p3 task that is 30 days overdue
- **THEN** system selects the p1 task (priority always wins over due date)

#### Scenario: Random within same priority

- **WHEN** current next task is completed/deferred and 10 p2 tasks are eligible
- **THEN** system randomly selects 1 from that group as the new next task

#### Scenario: Falls through to lower priority

- **WHEN** all p1 tasks are completed/deferred and p2 tasks exist
- **THEN** system selects randomly from the p2 group

#### Scenario: No eligible tasks

- **WHEN** no tasks match the selection criteria (all context tasks done)
- **THEN** system displays an empty state

### Requirement: Stable task across sessions

The "Next" page SHALL present the same task until it is completed or deferred.
Refreshing the page, switching devices, or reopening the app SHALL NOT change
which task is shown. A new task is only selected when the current one is
completed or deferred.

#### Scenario: Same task after refresh

- **WHEN** user views a task on Next, closes the app, and reopens
- **THEN** the same task is still shown

#### Scenario: Same task across devices

- **WHEN** user sees a task on desktop, then checks from phone
- **THEN** the same task is shown on both devices

#### Scenario: New task after completion

- **WHEN** user completes the current next task
- **THEN** system selects a new task from the eligible pool

#### Scenario: New task after deferral

- **WHEN** user defers the current next task
- **THEN** system selects a new task from the eligible pool

#### Scenario: Context window changes

- **WHEN** the active context changes (e.g., work hours end)
- **AND** the current next task is no longer in an active context
- **THEN** system selects a new task from the now-active contexts

### Requirement: Deferred tasks respect contexts

When a deferred task's `deferred_until` time passes, the task SHALL only appear
if at least one of its effective contexts is currently active.

#### Scenario: Defer work task to evening

- **WHEN** user defers a work-only task to 6:00 PM (outside work hours)
- **THEN** task does not appear at 6:00 PM
- **AND** task appears next morning when work context is active

#### Scenario: Defer task with multiple contexts

- **WHEN** user defers a task with "work" and "evening" contexts to 6:00 PM
- **AND** evening context is 5pm-10pm all days
- **THEN** task appears at 6:00 PM (evening context is active)

## REMOVED Requirements

### Requirement: Must-do task priority

**Reason**: `must_do` is removed from the system. Priority handles urgency.

**Migration**: Drop `must_do` column from tasks table. No production data uses
this field.

### Requirement: Must-do cannot be deferred

**Reason**: `must_do` is removed from the system entirely.

**Migration**: No migration needed — feature was not in active use.
