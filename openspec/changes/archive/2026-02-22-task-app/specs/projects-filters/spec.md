# Projects & Filters Spec

## ADDED Requirements

### Requirement: Create project

The system SHALL allow users to create projects with a name and optional
description. Projects group related tasks.

#### Scenario: Create project

- **WHEN** user creates a project named "Home Improvement"
- **THEN** system saves the project and it becomes available for task assignment

### Requirement: Edit project

The system SHALL allow users to rename or update the description of a project.

#### Scenario: Rename project

- **WHEN** user changes project name from "Home" to "Home Improvement"
- **THEN** system updates the project; all associated tasks retain the link

### Requirement: Delete project

The system SHALL allow users to delete a project. Tasks in the deleted project
SHALL be moved to Inbox (project_id set to null).

#### Scenario: Delete project with tasks

- **WHEN** user deletes a project containing 5 tasks
- **THEN** system deletes the project; 5 tasks move to Inbox

### Requirement: Inbox for unassigned tasks

The system SHALL provide an Inbox view showing all tasks without a project
assignment. Inbox is a virtual view, not a stored project.

#### Scenario: New task lands in Inbox

- **WHEN** user creates a task without selecting a project
- **THEN** task appears in Inbox

#### Scenario: Move task out of Inbox

- **WHEN** user assigns a task from Inbox to a project
- **THEN** task no longer appears in Inbox

### Requirement: Assign task to project

The system SHALL allow users to assign a task to a project or remove the project
assignment (moving to Inbox).

#### Scenario: Move task to project

- **WHEN** user assigns a task to project "Work"
- **THEN** system sets `project_id` to the Work project's ID

#### Scenario: Move task to Inbox

- **WHEN** user removes project assignment from a task
- **THEN** system sets `project_id = null`; task appears in Inbox

### Requirement: Saved filters

The system SHALL allow users to create, edit, and delete saved filter
configurations. Filters combine multiple criteria for quick access to task
subsets.

Filter criteria:

- Project (single or multiple, including Inbox)
- Priority (low, medium, high - multiple allowed)
- Contexts (multiple allowed)
- Due date range (today, this week, overdue, no due date)
- Completion status (incomplete, completed, all)

#### Scenario: Create saved filter

- **WHEN** user saves a filter "High Priority Work" with project=Work,
  priority=high
- **THEN** system stores the filter configuration

#### Scenario: Apply saved filter

- **WHEN** user selects saved filter "High Priority Work"
- **THEN** task list shows only high priority tasks in Work project

#### Scenario: Edit saved filter

- **WHEN** user edits filter "High Priority Work" to also include medium
  priority
- **THEN** system updates the filter configuration

### Requirement: Delete saved filter

The system SHALL allow users to delete saved filters.

#### Scenario: Delete filter

- **WHEN** user deletes saved filter "High Priority Work"
- **THEN** system removes the filter; task list unaffected

### Requirement: Quick filters

The system SHALL provide quick filter buttons for common views without requiring
saved filters:

- Today (due today or overdue)
- This week (due within 7 days)
- Inbox (no project)
- By project (dropdown)
- By context (dropdown)

#### Scenario: Quick filter by today

- **WHEN** user clicks "Today" quick filter
- **THEN** task list shows tasks due today or overdue
