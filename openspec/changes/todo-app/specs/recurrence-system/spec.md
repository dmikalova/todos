# Recurrence System Spec

## ADDED Requirements

### Requirement: Fixed schedule recurrence with friendly UI

The system SHALL support fixed schedule recurrence using structured fields
instead of cron expressions. Supported patterns:

- **Daily**: Every N days
- **Weekly**: Every N weeks on specific days (Mon, Tue, etc.)
- **Monthly**: Every N months on a specific date (1st, 15th, etc.)
- **Yearly**: Every N years on a specific month and date

#### Scenario: Weekly recurring task

- **WHEN** user creates a task recurring "every Monday"
- **THEN** system stores `frequency='weekly', interval=1, days_of_week=[1]`

#### Scenario: Bi-weekly on multiple days

- **WHEN** user creates a task recurring "every 2 weeks on Mon/Wed/Fri"
- **THEN** system stores `frequency='weekly', interval=2, days_of_week=[1,3,5]`

#### Scenario: Monthly on specific date

- **WHEN** user creates a task recurring "1st of each month"
- **THEN** system stores `frequency='monthly', interval=1, day_of_month=1`

#### Scenario: Monthly on date exceeding month length

- **WHEN** task recurs on the 30th of each month
- **AND** next occurrence falls in February (28 days)
- **THEN** system sets due date to February 28th (last day of month)

#### Scenario: Monthly on 31st in short month

- **WHEN** task recurs on the 31st of each month
- **AND** next occurrence falls in April (30 days)
- **THEN** system sets due date to April 30th

#### Scenario: Complete fixed recurring task

- **WHEN** user completes a task with fixed schedule recurrence
- **THEN** system marks task complete and creates new task instance with
  `due_date` set to next occurrence based on frequency/interval

### Requirement: Completion-based recurrence

The system SHALL support completion-based recurrence where the next task appears
N days after the current task is completed. This is useful for tasks like
"haircut" where the interval matters more than the specific day.

#### Scenario: Create completion-based recurring task

- **WHEN** user creates a task with 14-day completion-based recurrence
- **THEN** system creates a recurrence rule with `schedule_type = 'completion'`
  and `days_after_completion = 14`

#### Scenario: Complete completion-based recurring task

- **WHEN** user completes a task with completion-based recurrence (14 days)
- **THEN** system marks task complete and creates new task instance with
  `due_date` set to 14 days from now

### Requirement: Single active instance per recurrence

The system SHALL maintain only one active (non-completed) task instance per
recurrence rule. This prevents task pile-up when tasks aren't completed on time.

#### Scenario: Prevent duplicate recurring instances

- **WHEN** a recurrence rule already has an active task instance
- **THEN** system SHALL NOT create additional instances until the current one is
  completed

### Requirement: Edit recurrence pattern

The system SHALL allow users to edit the recurrence pattern of an existing
recurring task.

#### Scenario: Change from weekly to monthly

- **WHEN** user changes a task from "every Monday" to "1st of each month"
- **THEN** system updates the recurrence rule; next completion uses new pattern

### Requirement: Remove recurrence from task

The system SHALL allow users to remove recurrence from a task, converting it to
a one-time task.

#### Scenario: Convert recurring to one-time

- **WHEN** user removes recurrence from a recurring task
- **THEN** system deletes the recurrence rule; current task becomes
  non-recurring
