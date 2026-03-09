# ADDED Requirements

## Requirement: Open tasks load fully on startup

The client SHALL load all incomplete (open) tasks on startup. There is no cap on
open task loading.

### Scenario: All open tasks are available client-side

- **WHEN** the app initializes
- **THEN** all tasks where `completed = false` are loaded into the client
- **AND** they are available for the Next view, inbox, and project views without
  additional fetches

## Requirement: Done tasks load as capped initial batch

The client SHALL load the 100 most recently completed tasks on startup (ordered
by completion date descending). Additional done tasks are loaded on demand via
infinite scroll in the history view.

### Scenario: Done tasks load with initial cap of 100

- **WHEN** the app initializes
- **THEN** the client fetches the 100 most recently completed tasks ordered by
  completion date descending

### Scenario: Done tasks beyond 100 are not loaded initially

- **WHEN** a user has more than 100 completed tasks
- **THEN** only the 100 most recently completed tasks are loaded at startup

### Scenario: History view loads more on scroll

- **WHEN** the user scrolls to the end of the history list
- **THEN** the next batch of completed tasks is fetched and appended to the list

### Scenario: History infinite scroll ends when exhausted

- **WHEN** there are no more completed tasks to load
- **THEN** no further fetch is triggered and the end of the list is indicated
