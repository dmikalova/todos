## ADDED Requirements

### Requirement: Context navigation view

The system SHALL provide a navigation view for each context, accessible by
clicking the context in the sidebar. This view displays all tasks whose
effective context includes that context (resolved through CSS cascade
inheritance).

#### Scenario: Click context in sidebar

- **WHEN** user clicks on "weekend" context in the sidebar
- **THEN** the system displays all tasks whose effective context includes
  "weekend"
- **AND** the view uses the same layout as the project task list

#### Scenario: View includes inherited tasks

- **WHEN** a project has context "weekend" and its tasks have no direct contexts
- **THEN** those tasks appear in the "weekend" context navigation view

#### Scenario: View excludes overridden tasks

- **WHEN** a task in a "weekend" project has its own context "work"
- **THEN** that task does NOT appear in the "weekend" context navigation view

### Requirement: Context view controls

The context navigation view SHALL include the same controls as the project view:
edit functionality, and a done/all/next toggle in the top right for filtering
task completion status.

#### Scenario: Toggle between all and active tasks

- **WHEN** user clicks "all" in the context view
- **THEN** both completed and incomplete tasks with that context are shown

#### Scenario: Toggle to done tasks only

- **WHEN** user clicks "done" in the context view
- **THEN** only completed tasks with that context are shown

#### Scenario: Default shows incomplete tasks

- **WHEN** user opens a context navigation view
- **THEN** only incomplete tasks are shown by default

### Requirement: Context view task ordering

Tasks in the context navigation view SHALL be ordered by task priority
descending, then due date ascending (undated last), then title alphabetically.

#### Scenario: Higher priority tasks first

- **WHEN** the context view contains tasks with different priorities
- **THEN** higher-priority tasks appear before lower-priority tasks

#### Scenario: Due date ordering within same priority

- **WHEN** tasks have the same priority but different due dates
- **THEN** earlier due dates appear first, undated tasks appear last

#### Scenario: Alphabetical tiebreaker

- **WHEN** tasks have the same priority and due date (or both undated)
- **THEN** tasks are sorted alphabetically by title
