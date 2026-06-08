# MODIFIED Requirements

## Requirement: 100% test coverage for all source files

Every source file under `src/` SHALL have corresponding tests. Coverage MUST be
measured and enforced via `deno test --coverage`. No untested code paths SHALL
exist.

Current coverage gaps to close (branch% / line%):

- `src/middleware.ts` (68.4% / 27.9%)
- `src/routes/contexts.ts` (50.0% / 71.3%)
- `src/routes/export.ts` (100.0% / 7.2%)
- `src/routes/filters.ts` (100.0% / 14.2%)
- `src/routes/history.ts` (100.0% / 14.2%)
- `src/routes/import.ts` (100.0% / 19.0%)
- `src/routes/next.ts` (66.7% / 84.4%)
- `src/routes/projects.ts` (77.4% / 52.3%)
- `src/routes/recurrence.ts` (52.9% / 51.9%)
- `src/routes/tasks.ts` (59.7% / 80.9%)
- `src/services/history.ts` (0.0% / 36.8%)
- `src/services/ownership.ts` (40.0% / 66.7%)
- `src/services/recurrence.ts` (76.5% / 77.3%)
- `src/services/scoring.ts` (93.5% / 98.3%)

### Scenario: Coverage report passes 100%

- **WHEN** `deno test --coverage` is run
- **THEN** all source files report 100% line and branch coverage

## ADDED Requirements

### Requirement: Project nesting unit tests

Unit tests SHALL cover the store's tree computation and circular reference
prevention logic.

### Scenario: projectTree computes correct depths

- **WHEN** `projectTree` is called with nested projects
- **THEN** each entry has the correct depth value matching its nesting level

### Scenario: projectTree orders children after parent

- **WHEN** `projectTree` is called with parent and child projects
- **THEN** children appear immediately after their parent in the output

### Scenario: Descendant exclusion list computed correctly

- **WHEN** `getDescendantIds(projectId)` is called
- **THEN** it returns all recursive descendant project IDs

### Scenario: Collapse state filters tree correctly

- **WHEN** `projectTree` is called with collapsed parent IDs
- **THEN** children of collapsed parents are excluded from the output

### Scenario: Alphabetical ordering within siblings

- **WHEN** siblings exist with different names
- **THEN** `projectTree` orders them alphabetically by name

## Requirement: Project nesting integration tests

Integration tests SHALL cover the nested project API behavior.

### Scenario: Create nested project via API

- **WHEN** POST /api/projects is called with `parentProjectId`
- **THEN** the response includes the correct `parent_project_id`

### Scenario: Update parent prevents circular reference

- **WHEN** PATCH /api/projects/:id sets `parentProjectId` to a descendant
- **THEN** the API returns 400 Bad Request

### Scenario: Delete parent orphans children

- **WHEN** a parent project is deleted
- **THEN** child projects have `parent_project_id` set to null

## Requirement: Coverage gap tests for routes

Integration tests SHALL be added or expanded to cover all untested paths in
route files.

### Scenario: All route branches exercised

- **WHEN** integration tests run against route files
- **THEN** every conditional branch in `contexts.ts`, `export.ts`, `filters.ts`,
  `history.ts`, `import.ts`, `next.ts`, `projects.ts`, `recurrence.ts`, and
  `tasks.ts` is exercised

## Requirement: Coverage gap tests for services

Unit and integration tests SHALL cover all untested paths in service files.

### Scenario: All service branches exercised

- **WHEN** tests run against service files
- **THEN** every conditional branch in `history.ts`, `ownership.ts`,
  `recurrence.ts`, and `scoring.ts` is exercised

## Requirement: Coverage gap tests for middleware

Integration tests SHALL cover all middleware paths including error handling and
auth edge cases.

### Scenario: All middleware branches exercised

- **WHEN** integration tests exercise the middleware
- **THEN** every conditional branch in `middleware.ts` is exercised
