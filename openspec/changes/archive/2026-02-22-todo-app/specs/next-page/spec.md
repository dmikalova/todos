# Next Page Spec

## ADDED Requirements

### Requirement: Smart task selection

The system SHALL select tasks for the "Next" page using a scoring algorithm with
weighted randomness. The algorithm considers due date, priority, and must-do
status while introducing variety among similar-scored tasks.

Selection criteria:

1. Eligible tasks: `due_date <= today` OR `due_date IS NULL`, AND
   `completed_at IS NULL`
2. Context filter: at least one task context is currently active, OR task has no
   contexts
3. Deferred filter: `deferred_until IS NULL` OR `deferred_until <= NOW()`

Scoring formula: `priority_weight + overdue_days + (must_do ? 1000 : 0)`

- Priority weights: high=30, medium=20, low=10
- Overdue days: number of days past due date (0 if not overdue or no due date)

Within a score tier (tasks within 5 points), selection is randomized to ensure
variety. This prevents the same tasks from always appearing when many tasks have
similar scores.

#### Scenario: Select with randomness among equals

- **WHEN** user opens "Next" page with 10 medium-priority tasks (all score ~20)
- **THEN** system randomly selects 2 from that group, varying on each refresh

#### Scenario: Select top two tasks

- **WHEN** user opens the "Next" page with tasks at different score tiers
- **THEN** system displays 2 tasks from the highest-scoring tiers

#### Scenario: Must-do task priority

- **WHEN** a must-do task exists with low priority
- **THEN** must-do task appears in top 2 due to 1000-point bonus

#### Scenario: No eligible tasks

- **WHEN** no tasks match the selection criteria
- **THEN** system displays "All caught up!" message

### Requirement: Two-option presentation

The "Next" page SHALL display exactly two tasks (or fewer if less are available)
giving the user choice without decision fatigue.

#### Scenario: Exactly two options shown

- **WHEN** 5 eligible tasks exist
- **THEN** system shows only the top 2 by score

#### Scenario: One task available

- **WHEN** only 1 eligible task exists
- **THEN** system shows that single task

### Requirement: Defer action

The system SHALL allow users to defer tasks from the "Next" page. Deferring sets
`deferred_until` timestamp and logs to task history.

Defer options:

- Later today: +4 hours
- Tomorrow: next day 9:00 AM
- Next week: following Monday 9:00 AM
- Next occurrence: skip to next recurrence date (recurring tasks only)

#### Scenario: Defer until later today

- **WHEN** user defers a task "later today" at 2:00 PM
- **THEN** system sets `deferred_until = 6:00 PM today`

#### Scenario: Defer until tomorrow

- **WHEN** user defers a task to "tomorrow"
- **THEN** system sets `deferred_until = tomorrow 9:00 AM`

#### Scenario: Defer to next occurrence

- **WHEN** user defers a recurring task to "next occurrence"
- **THEN** system sets `deferred_until` to the next recurrence date

### Requirement: Undo defer

The system SHALL allow users to clear a task's deferral, making it immediately
eligible again.

#### Scenario: Undo recent defer

- **WHEN** user defers a task, then clicks "Undo" in the confirmation toast
- **THEN** system clears `deferred_until` and task becomes eligible again

#### Scenario: Clear defer from task list

- **WHEN** user views a deferred task in the task list and clicks "Clear defer"
- **THEN** system clears `deferred_until` and logs the undo to history

### Requirement: Deferred tasks respect contexts

When a deferred task's `deferred_until` time passes, the task SHALL only appear
if at least one of its contexts is currently active. Tasks with no contexts
appear immediately when defer expires.

#### Scenario: Defer work task to evening

- **WHEN** user defers a work-only task to 6:00 PM (outside work hours)
- **THEN** task does not appear at 6:00 PM
- **AND** task appears next morning when work context is active

#### Scenario: Defer task with multiple contexts

- **WHEN** user defers a task with "work" and "evening" contexts to 6:00 PM
- **AND** evening context is 5pm-10pm all days
- **THEN** task appears at 6:00 PM (evening context is active)

### Requirement: Must-do cannot be deferred

Tasks with `must_do = true` SHALL NOT show defer options. The only action
available is to complete them.

#### Scenario: Must-do task actions

- **WHEN** must-do task appears on "Next" page
- **THEN** system shows only "Complete" button, no defer options

### Requirement: Quick complete from Next page

The system SHALL allow users to mark a task complete directly from the "Next"
page without navigating to task details.

#### Scenario: Complete from Next page

- **WHEN** user clicks "Complete" on a task in the Next page
- **THEN** system marks task complete, logs it, and refreshes with new top 2
  tasks

### Requirement: Manual context override

The "Next" page SHALL include a context selector allowing users to manually
activate any context, showing tasks from that context regardless of time.

#### Scenario: Enter work context manually

- **WHEN** user selects "work" context on Saturday
- **THEN** Next page shows work tasks even though work hours aren't active
