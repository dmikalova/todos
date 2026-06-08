k## MODIFIED Requirements

### Requirement: User-defined contexts

The system SHALL allow users to create, edit, and delete contexts. Each context
has a name, color, rank (via sort_order position), and time windows configured
per day of the week.

#### Scenario: Create work context

- **WHEN** user creates a context "work" with Mon-Fri 9:00-17:00
- **THEN** system saves time windows for days 1-5 (Mon-Fri)

#### Scenario: Create cleanup context

- **WHEN** user creates a context "tuesday cleanup" with Tue 18:00-21:00
- **THEN** system saves time window for day 2

#### Scenario: Edit context time window

- **WHEN** user changes work context Friday from 9-5 to 9-3
- **THEN** system updates Friday's time window to 09:00-15:00

#### Scenario: Delete context

- **WHEN** user deletes a context
- **THEN** system removes the context and all associations on projects/tasks

### Requirement: Context rank

Each context SHALL have a rank (stored as `sort_order`, unique per user). Rank
determines which context's tasks are presented first in Next when multiple
contexts are active simultaneously. Lower `sort_order` = higher rank = shown
first.

Ranks are mutually exclusive — no two contexts share the same rank. The rank
order is determined by the context's position in the sidebar list. Users reorder
contexts via drag-and-drop in the sidebar or up/down controls in the context
editor (which shows neighboring contexts for reference).

#### Scenario: Two contexts active, different ranks

- **WHEN** both "work" (rank 1) and "evening" (rank 3) are active
- **THEN** Next view groups work tasks before evening tasks

#### Scenario: Reorder context rank via sidebar

- **WHEN** user drags "evening" above "work" in the sidebar
- **THEN** "evening" gets a lower sort_order than "work"
- **AND** Next now shows evening tasks before work tasks when both are active

#### Scenario: Adjust rank in context editor

- **WHEN** user opens context editor for "weekend" and clicks "increase rank"
- **THEN** the context moves up one position
- **AND** the editor shows the context now above and below for reference

### Requirement: Multi-context task assignment

The system SHALL allow tasks to have zero, one, or multiple contexts assigned
(either directly or inherited from projects). Tasks appear in Next page when ANY
of their effective contexts are active.

#### Scenario: Assign multiple contexts

- **WHEN** user assigns contexts "tuesday cleanup" and "weekend" to a task
- **THEN** task is eligible during both tuesday cleanup hours AND weekend hours

#### Scenario: Task with no effective context

- **WHEN** a task has no contexts assigned and inherits none from its project
- **THEN** task does not appear in Next (only visible in project/filter views)

### Requirement: Deferred tasks respect contexts

When a deferred task's `deferred_until` time passes, the task SHALL only appear
in Next if at least one of its effective contexts is currently active.

#### Scenario: Defer work task to evening

- **WHEN** user defers a work task to 6:00 PM (outside work hours)
- **THEN** task does not appear at 6:00 PM
- **AND** task appears next morning when work context is active

#### Scenario: Manual override shows deferred task

- **WHEN** user defers a work task to 6:00 PM
- **AND** user manually enters work context at 7:00 PM
- **THEN** task appears (context manually active)

## REMOVED Requirements

### Requirement: Default context

**Reason**: Removed to simplify onboarding. Users create their own contexts as
needed. No pre-seeded defaults.

**Migration**: No migration needed — the default context was never implemented
in production.
