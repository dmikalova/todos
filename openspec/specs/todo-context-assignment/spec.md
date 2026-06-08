# Todo Context Assignment

## Purpose

Define how contexts are assigned to projects and tasks, and how inheritance
works through the project hierarchy. Contexts can be set on projects,
sub-projects, or individual tasks. Inheritance follows CSS-style cascade:
most-specific assignment wins.

## Requirements

## Requirement: Projects support multiple contexts

A project SHALL support assignment of zero or more contexts via a join table.
The system MUST persist context assignments when a project is saved and return
them when the project is fetched.

### Scenario: Save a project with contexts

- **WHEN** a user saves a project with one or more contexts selected
- **THEN** the backend persists the context assignments on the project
- **AND** subsequent fetch of the project includes the assigned contexts

### Scenario: Save a project with no contexts

- **WHEN** a user saves a project with no contexts selected
- **THEN** the backend stores no context associations for that project
- **AND** the project inherits contexts from its nearest ancestor project that
  has contexts

### Scenario: Update contexts on an existing project

- **WHEN** a user changes the contexts on an already-saved project and saves
- **THEN** the backend replaces the previous context assignments with the new
  ones

## Requirement: Tasks support multiple contexts (override)

Tasks SHALL support assignment of zero or more contexts via a join table. When a
task has its own contexts, those override any inherited project contexts
(CSS-style cascade).

### Scenario: Task with own contexts overrides project

- **WHEN** a task has contexts assigned directly
- **THEN** its effective contexts are its own (project contexts ignored)

### Scenario: Task with no contexts inherits from project

- **WHEN** a task has no direct context assignments
- **THEN** its effective contexts come from its project (or nearest ancestor
  project with contexts)

## Requirement: Nested project context inheritance

A project with no contexts assigned SHALL inherit contexts from its nearest
ancestor project that has contexts set. Most-specific wins (CSS cascade).

### Scenario: Child project inherits parent contexts

- **WHEN** a child project has no contexts set and its parent project has
  contexts
- **THEN** the child project's effective contexts are the parent's contexts

### Scenario: Child project overrides parent contexts

- **WHEN** a child project has its own contexts and its parent also has contexts
- **THEN** the child project's effective contexts are its own (parent ignored)

### Scenario: Multi-level inheritance

- **WHEN** a project has no contexts and its parent also has no contexts, but
  the grandparent does
- **THEN** the project's effective contexts are the grandparent's contexts

### Scenario: No ancestor has contexts

- **WHEN** a project and all its ancestors have no contexts set
- **THEN** the project's effective contexts are empty and its tasks are
  contextless (do not appear in Next)

## Requirement: Context field in project form

The project form SHALL display a multi-select context picker showing all
available contexts. The picker MUST reflect the project's current context
assignments on load.

### Scenario: Context field pre-populated on edit

- **WHEN** the user opens an existing project that has contexts assigned
- **THEN** the context picker shows those contexts as selected

### Scenario: Context field empty for new project

- **WHEN** the user opens the form to create a new project
- **THEN** the context picker shows no contexts selected

## Requirement: Context field in task form

The task form SHALL display an optional multi-select context picker. When empty,
the task inherits from its project. When populated, the task's contexts override
inheritance.

### Scenario: Task context picker shows inheritance hint

- **WHEN** the user opens a task form with no direct contexts
- **THEN** the picker shows inherited contexts as a hint (greyed/placeholder)
- **AND** the user can override by selecting explicit contexts

## Requirement: Project task count shows only open tasks

The task count displayed on a project SHALL reflect only incomplete (open)
tasks. Completed tasks MUST be excluded from the count.

### Scenario: Project with mixed tasks shows only open count

- **WHEN** a project has both open and completed tasks
- **THEN** the displayed task count equals the number of open tasks only

### Scenario: Project with all tasks done shows zero count

- **WHEN** all tasks in a project are completed
- **THEN** the displayed task count is 0
