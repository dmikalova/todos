# Todo Context Assignment

## Purpose

Define how contexts are assigned to projects and inherited by tasks. Contexts
are named, reusable labels (e.g., "morning", "evening") set on projects. Tasks
inherit context implicitly through their project.

## Requirements

## Requirement: Projects have a context

A project SHALL support assignment of a single named context. The system MUST
persist the context assignment when a project is saved and return it when the
project is fetched. Tasks within the project inherit this context implicitly.

### Scenario: Save a project with a context

- **WHEN** a user saves a project with a context selected
- **THEN** the backend persists the context assignment on the project
- **AND** subsequent fetch of the project includes the assigned context

### Scenario: Save a project with no context

- **WHEN** a user saves a project with no context selected
- **THEN** the backend stores null for context on that project
- **AND** the project inherits context from its parent project if one exists

### Scenario: Update context on an existing project

- **WHEN** a user changes the context on an already-saved project and saves
- **THEN** the backend replaces the previous context assignment with the new one

## Requirement: Tasks have no direct context

Tasks SHALL NOT have a `context_id` field. A task's context is determined solely
by its parent project.

### Scenario: Task context is derived from project

- **WHEN** the system evaluates which context a task belongs to
- **THEN** it uses the context of the task's project (or nearest ancestor
  project with a context)
- **AND** the task record itself contains no context field

## Requirement: Nested project context inheritance

A project with no context assigned SHALL inherit the context from its nearest
ancestor project that has a context set.

### Scenario: Child project inherits parent context

- **WHEN** a child project has no context set and its parent project has a
  context
- **THEN** the child project's effective context is the parent's context

### Scenario: Multi-level inheritance

- **WHEN** a project has no context and its parent also has no context, but the
  grandparent does
- **THEN** the project's effective context is the grandparent's context

### Scenario: No ancestor has a context

- **WHEN** a project and all its ancestors have no context set
- **THEN** the project's effective context is null and its tasks do not appear
  in Next

## Requirement: Context field in project form

The project form SHALL display a context selector showing all available named
contexts. The selector MUST reflect the project's current context assignment on
load.

### Scenario: Context field pre-populated on edit

- **WHEN** the user opens an existing project that has a context assigned
- **THEN** the context selector shows that context as selected

### Scenario: Context field empty for new project

- **WHEN** the user opens the form to create a new project
- **THEN** the context selector shows no context selected

### Scenario: Context selector submits correct ID

- **WHEN** the user selects a context and saves the project
- **THEN** the form submits the context ID to the backend

## Requirement: Project task count shows only open tasks

The task count displayed on a project SHALL reflect only incomplete (open)
tasks. Completed tasks MUST be excluded from the count.

### Scenario: Project with mixed tasks shows only open count

- **WHEN** a project has both open and completed tasks
- **THEN** the displayed task count equals the number of open tasks only

### Scenario: Project with all tasks done shows zero count

- **WHEN** all tasks in a project are completed
- **THEN** the displayed task count is 0
