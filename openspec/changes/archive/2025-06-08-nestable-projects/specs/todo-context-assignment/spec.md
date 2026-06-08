# MODIFIED Requirements

## Requirement: Context field in project form

The project form SHALL display a context selector showing all available named
contexts. The selector MUST reflect the project's current context assignment on
load. When a project has no direct context but inherits one from an ancestor,
the selector SHALL show the inherited context name as placeholder text.

### Scenario: Context field pre-populated on edit

- **WHEN** the user opens an existing project that has a context assigned
- **THEN** the context selector shows that context as selected

### Scenario: Context field empty for new project

- **WHEN** the user opens the form to create a new project
- **THEN** the context selector shows no context selected

### Scenario: Context selector submits correct ID

- **WHEN** the user selects a context and saves the project
- **THEN** the form submits the context ID to the backend

### Scenario: Inherited context shown as placeholder

- **WHEN** the user opens a project that has no direct context but inherits one
  from an ancestor project
- **THEN** the context selector shows the inherited context name as placeholder
  text (e.g., "inherited: morning")
- **AND** the actual submitted value remains null unless the user explicitly
  selects a context
