# Context Multi-Assignment

## ADDED Requirements

### Requirement: Multi-context assignment on projects

The system SHALL support assigning zero or more contexts to a project via a
`project_contexts` join table. Multiple contexts allow a project's tasks to
appear in multiple time windows.

#### Scenario: Assign two contexts to a project

- **WHEN** user assigns contexts "tuesday cleanup" and "weekend" to a project
- **THEN** the system stores both associations in the join table
- **AND** tasks in that project are eligible during both context windows

#### Scenario: Project with no contexts assigned

- **WHEN** a project has no entries in `project_contexts`
- **THEN** the project inherits contexts from its nearest ancestor with contexts

### Requirement: Multi-context assignment on tasks

The system SHALL support assigning zero or more contexts to a task via a
`task_contexts` join table. When a task has direct contexts, they override any
inherited project contexts entirely.

#### Scenario: Assign context directly to a task

- **WHEN** user assigns context "weekend" to a task in project with context
  "work"
- **THEN** the task's effective contexts are only "weekend" (override)

#### Scenario: Task with no direct contexts inherits from project

- **WHEN** a task has no entries in `task_contexts`
- **THEN** the task's effective contexts come from its project (CSS cascade)

#### Scenario: Task with multiple direct contexts

- **WHEN** user assigns contexts "tuesday cleanup" and "weekend" to a task
- **THEN** the task is eligible during both context time windows

### Requirement: CSS-style cascade resolution

The system SHALL resolve a task's effective contexts using CSS-style cascade:
most-specific assignment wins, with no explicit inherit/don't-inherit flag.

Resolution order:

1. Task's own contexts (from `task_contexts`) — if any exist, use them
2. Task's project's contexts (from `project_contexts`) — if any exist, use them
3. Walk up `parent_project_id` chain until contexts found
4. If no contexts found anywhere: task is contextless

#### Scenario: Task contexts override project contexts

- **WHEN** a task has `task_contexts` entries
- **THEN** those are the effective contexts (project contexts ignored)

#### Scenario: Sub-project overrides parent project

- **WHEN** a sub-project has `project_contexts` entries and parent also does
- **THEN** the sub-project's contexts win for its tasks

#### Scenario: Deep inheritance through project tree

- **WHEN** a task's project and its parent have no contexts, but grandparent
  does
- **THEN** the task inherits the grandparent's contexts

#### Scenario: Contextless task (no contexts anywhere)

- **WHEN** no contexts exist on task, project, or any ancestor
- **THEN** the task is contextless and does not appear in Next view
