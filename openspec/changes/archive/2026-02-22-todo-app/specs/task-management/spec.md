# Task Management Spec

## ADDED Requirements

### Requirement: Create task

The system SHALL allow users to create a task with the following fields:

- Title (required, text with basic markdown support)
- Description (optional, text with basic markdown support)
- Due date (optional, date)
- Priority (required, enum: low, medium, high)
- Project (optional, foreign key to project; null = Inbox)
- Contexts (optional, multi-select from user-defined contexts)
- Must-do flag (optional, boolean, default false)

Basic markdown support includes: links `[text](url)`, bold `**text**`, italic
`*text*`, and inline code `` `code` ``. No block-level elements (headers, lists,
code blocks) in titles.

#### Scenario: Create minimal task

- **WHEN** user submits a task with only title and priority
- **THEN** system creates the task in Inbox with no contexts

#### Scenario: Create full task

- **WHEN** user submits a task with all fields including multiple contexts
- **THEN** system creates the task with all provided values

#### Scenario: Create task in current project

- **WHEN** user presses 'a' while viewing a project
- **THEN** system opens task form with that project pre-selected

### Requirement: Edit task

The system SHALL allow users to edit any field of an existing task. All edits
are logged to task history.

#### Scenario: Update task title

- **WHEN** user changes the title of an existing task
- **THEN** system saves the new title and logs the change

#### Scenario: Change task contexts

- **WHEN** user adds or removes contexts from a task
- **THEN** system updates the task_contexts join table

### Requirement: Delete task

The system SHALL allow users to delete a task. Deleting a task SHALL also delete
any associated recurrence rule and history entries.

#### Scenario: Delete non-recurring task

- **WHEN** user deletes a task without recurrence
- **THEN** system removes the task and its history from the database

#### Scenario: Delete recurring task

- **WHEN** user deletes a task with an associated recurrence rule
- **THEN** system removes the task, recurrence rule, and history

### Requirement: Complete task

The system SHALL allow users to mark a task as complete. Completion is logged to
task history. For recurring tasks, completion creates the next instance.

#### Scenario: Complete non-recurring task

- **WHEN** user completes a non-recurring task
- **THEN** system sets `completed_at` timestamp and logs completion

#### Scenario: Complete recurring task

- **WHEN** user completes a task with an associated recurrence rule
- **THEN** system marks current task complete, logs it, and creates next
  instance

#### Scenario: Undo complete

- **WHEN** user undoes a task completion (via undo toast or task list)
- **THEN** system clears `completed_at` and logs the undo to history

### Requirement: List tasks

The system SHALL display tasks with filtering and sorting options.

#### Scenario: View all incomplete tasks

- **WHEN** user views the task list
- **THEN** system displays all tasks where `completed_at` is null

#### Scenario: Filter by project

- **WHEN** user selects a project filter
- **THEN** system displays only tasks belonging to that project

#### Scenario: Sort by due date

- **WHEN** user sorts by due date
- **THEN** system orders tasks by due date ascending (nulls last)

### Requirement: Task history

The system SHALL log all task events to a history table:

- Created
- Completed
- Deferred (with defer details)
- Edited (with old/new values)

#### Scenario: View task history

- **WHEN** user opens task details
- **THEN** system shows activity log with timestamps
