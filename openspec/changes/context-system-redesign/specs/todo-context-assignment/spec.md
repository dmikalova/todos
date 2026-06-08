# Todo Context Assignment

## MODIFIED Requirements

### Requirement: Projects support multiple contexts

A project SHALL support assignment of zero or more contexts via a join table.
The system MUST persist context assignments when a project is saved and return
them when the project is fetched.

#### Scenario: Save a project with contexts

- **WHEN** a user saves a project with one or more contexts selected
- **THEN** the backend persists the context associations in `project_contexts`
- **AND** subsequent fetch of the project includes the assigned context IDs

#### Scenario: Save a project with no contexts

- **WHEN** a user saves a project with no contexts selected
- **THEN** the backend stores no entries in `project_contexts` for that project
- **AND** the project inherits contexts from its nearest ancestor project

#### Scenario: Update contexts on an existing project

- **WHEN** a user changes the contexts on a project and saves
- **THEN** the backend replaces previous `project_contexts` entries with new
  ones

### Requirement: Tasks support multiple contexts (override)

Tasks SHALL support assignment of zero or more contexts via a `task_contexts`
join table. When a task has its own contexts, those override any inherited
project contexts (CSS-style cascade).

#### Scenario: Task with own contexts overrides project

- **WHEN** a task has entries in `task_contexts`
- **THEN** its effective contexts are its own (project contexts ignored)

#### Scenario: Task with no contexts inherits from project

- **WHEN** a task has no entries in `task_contexts`
- **THEN** its effective contexts come from its project (or nearest ancestor)

### Requirement: Nested project context inheritance

A project with no contexts assigned SHALL inherit contexts from its nearest
ancestor project that has contexts set. Most-specific wins (CSS cascade).

#### Scenario: Child project inherits parent contexts

- **WHEN** a child project has no contexts and its parent does
- **THEN** the child project's effective contexts are the parent's contexts

#### Scenario: Child project overrides parent contexts

- **WHEN** a child project has its own contexts and its parent also does
- **THEN** the child project's effective contexts are its own (parent ignored)

#### Scenario: Multi-level inheritance

- **WHEN** a project has no contexts, parent has none, but grandparent does
- **THEN** the project's effective contexts are the grandparent's contexts

#### Scenario: No ancestor has contexts

- **WHEN** a project and all ancestors have no contexts
- **THEN** effective contexts are empty; tasks don't appear in Next

### Requirement: Context multi-select in project form

The project form SHALL display a multi-select context picker showing all
available contexts.

#### Scenario: Context picker pre-populated on edit

- **WHEN** user opens a project that has contexts assigned
- **THEN** the multi-select shows those contexts as selected

#### Scenario: Context picker empty for new project

- **WHEN** user opens the form to create a new project
- **THEN** the multi-select shows no contexts selected

### Requirement: Context multi-select in task form

The task form SHALL display an optional multi-select context picker. When empty,
the task inherits from its project. When populated, the task's contexts
override.

#### Scenario: Task form shows inheritance hint

- **WHEN** user opens a task form with no direct contexts
- **THEN** the picker shows inherited contexts as a placeholder/hint

#### Scenario: Task form override

- **WHEN** user selects contexts in the task form
- **THEN** those contexts are stored as direct task contexts (overriding
  project)

## REMOVED Requirements

### Requirement: Tasks have no direct context

**Reason**: Tasks now support direct multi-context assignment via
`task_contexts` join table to enable per-task context overrides.

**Migration**: No data migration needed — tasks previously had no context field.

### Requirement: Projects have a context (singular)

**Reason**: Replaced by multi-context support via `project_contexts` join table.

**Migration**: Existing `context_id` values migrated to `project_contexts` join
table entries before column removal.
