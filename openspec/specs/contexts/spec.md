# Contexts Spec

## ADDED Requirements

### Requirement: User-defined contexts

The system SHALL allow users to create, edit, and delete contexts. Each context
has a name and time windows configured per day of the week.

#### Scenario: Create work context

- **WHEN** user creates a context "work" with Mon-Fri 9:00-17:00
- **THEN** system saves time windows for days 1-5 (Mon-Fri)

#### Scenario: Create gym context

- **WHEN** user creates a context "Gym" with Mon/Wed/Fri 6:00-8:00
- **THEN** system saves time windows for days 1, 3, 5

#### Scenario: Edit context time window

- **WHEN** user changes work context Friday from 9-5 to 9-3
- **THEN** system updates Friday's time window to 09:00-15:00

#### Scenario: Delete context

- **WHEN** user deletes a context
- **THEN** system removes the context; tasks with that context lose it

### Requirement: Default context

The system SHALL seed one default context on first use:

- `work`: Mon-Fri 09:00-17:00

Users MAY delete this default. Tasks without contexts are always eligible (no
separate "weekend" context needed).

#### Scenario: Initial context setup

- **WHEN** new user opens the app for the first time
- **THEN** system shows "work" context pre-configured with weekday hours

### Requirement: Multi-context task assignment

The system SHALL allow tasks to have zero, one, or multiple contexts assigned.
Tasks appear in Next page when ANY of their contexts are active.

#### Scenario: Assign multiple contexts

- **WHEN** user assigns contexts "work" and "gym" to a task
- **THEN** task is eligible during both work hours AND gym hours

#### Scenario: Task with no context

- **WHEN** task has no contexts assigned
- **THEN** task is always eligible for Next page (no time restrictions)

### Requirement: Context detection via local time

The system SHALL use the client's local time to determine which contexts are
currently active. Client sends local time with API requests.

#### Scenario: Timezone travel

- **WHEN** user travels from EST to PST and opens app at 10:00 AM PST
- **THEN** system detects work context (10am local is within 9-5)

#### Scenario: Multiple contexts active

- **WHEN** user has both "morning" (6-9am) and "work" (9-5) contexts
- **AND** current time is 8:30 AM
- **THEN** system reports both "morning" and "work" as active (overlapping)

### Requirement: Manual context override

The system SHALL allow users to manually select any context to view tasks from
that context, regardless of current time.

#### Scenario: Enter work context on weekend

- **WHEN** user clicks "work" context on Saturday
- **THEN** Next page shows work tasks even though work context isn't time-active

### Requirement: Deferred tasks respect contexts

When a deferred task's `deferred_until` time passes, the task SHALL only appear
if at least one of its contexts is currently active (or task has no contexts).

#### Scenario: Defer work task to evening

- **WHEN** user defers a work task to 6:00 PM (outside work hours)
- **THEN** task does not appear at 6:00 PM
- **AND** task appears next morning when work context is active

#### Scenario: Manual override shows deferred task

- **WHEN** user defers a work task to 6:00 PM
- **AND** user manually enters work context at 7:00 PM
- **THEN** task appears (context manually active)
