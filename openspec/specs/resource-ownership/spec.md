# Resource Ownership

## Purpose

Enforce multi-user data isolation via dual-layer ownership: Postgres Row Level
Security (RLS) as a database-level backstop and application-level
`assertOwnership` for clear HTTP error responses.

## Requirements

## Requirement: All tables have a user_id column

Every table in the schema SHALL have a `user_id` column (UUID, NOT NULL). This
column identifies the owning user for every row. New rows MUST set `user_id`
from the authenticated session.

### Scenario: user_id column exists on all tables

- **WHEN** the schema is inspected
- **THEN** every table (projects, contexts, context_time_windows, tasks,
  recurrence_rules, saved_filters, task_history) has a `user_id` UUID NOT NULL
  column

### Scenario: New rows set user_id from session

- **WHEN** a new row is inserted via any API route
- **THEN** the `user_id` is set from the authenticated user's session, not from
  client input

## Requirement: Row Level Security enabled on all tables

Postgres Row Level Security (RLS) SHALL be enabled on every table. RLS policies
SHALL restrict all operations (SELECT, INSERT, UPDATE, DELETE) to rows where
`user_id` matches the current session's user ID set via
`current_setting('app.user_id')`.

### Scenario: RLS blocks access to other users' rows

- **WHEN** a query runs with `app.user_id` set to user A
- **THEN** only rows where `user_id = A` are visible or modifiable
- **AND** rows belonging to user B are invisible

### Scenario: INSERT policy enforces user_id matches session

- **WHEN** an INSERT is attempted with a `user_id` different from
  `current_setting('app.user_id')`
- **THEN** the INSERT is rejected by the RLS policy

## Requirement: Session user ID set on each request

The application middleware SHALL execute `SET LOCAL app.user_id = '<userId>'` at
the start of each database transaction, before any queries run. This makes RLS
policies effective with the direct postgres.js connection and Supavisor
transaction pooler.

### Scenario: Middleware sets app.user_id

- **WHEN** an authenticated API request is processed
- **THEN** the middleware executes `SET LOCAL app.user_id` with the session user
  ID before any route handler queries

### Scenario: SET LOCAL scoped to transaction

- **WHEN** the transaction completes
- **THEN** the `app.user_id` setting is automatically cleared (SET LOCAL is
  transaction-scoped)

## Requirement: All resource IDs validated against authenticated user

In addition to RLS, before any route uses a submitted resource ID (contextId,
projectId, parentProjectId, taskId), the backend MUST verify that the referenced
resource belongs to the authenticated user via the application-level
`assertOwnership` helper. This provides clear HTTP error codes (403 for foreign
IDs, 404 for non-existent IDs) that RLS alone cannot provide (RLS silently
filters).

This applies to:

- `projectId` submitted on task create/update
- `contextId` submitted on project create/update
- `parentProjectId` submitted on project create/update

### Scenario: Valid owned context ID accepted

- **WHEN** a user submits a contextId that belongs to them
- **THEN** the request proceeds normally

### Scenario: Foreign context ID rejected

- **WHEN** a user submits a contextId that exists but belongs to another user
- **THEN** the route returns 403 Forbidden
- **AND** the resource is not modified

### Scenario: Non-existent context ID rejected

- **WHEN** a user submits a contextId that does not exist
- **THEN** the route returns 400 Bad Request or 404 Not Found

### Scenario: Foreign project ID rejected on task create

- **WHEN** a user submits a projectId that belongs to another user
- **THEN** the route returns 403 Forbidden

### Scenario: Foreign parentProjectId rejected on nested project create

- **WHEN** a user submits a parentProjectId that belongs to another user
- **THEN** the route returns 403 Forbidden

## Requirement: Ownership check is a shared utility

Ownership validation SHALL be implemented as a reusable helper (e.g.,
`assertOwnership(sql, table, id, userId)`) rather than inline per-route logic,
to ensure consistency and prevent omission.

### Scenario: Ownership helper used consistently

- **WHEN** any route performs an ownership check
- **THEN** it uses the shared `assertOwnership` utility
- **AND** no route performs ad-hoc ownership SQL inline

## Requirement: Ownership validation is tested

Every ownership check MUST have a corresponding integration test that verifies a
403 is returned when a foreign resource ID is submitted.

### Scenario: Integration test for each ownership-guarded field

- **WHEN** integration tests are run
- **THEN** there are tests covering foreign contextId, foreign projectId, and
  foreign parentProjectId on the relevant routes

## Requirement: RLS is tested

Integration tests SHALL verify that RLS prevents cross-user data access at the
database level, independent of application-level checks.

### Scenario: RLS blocks SELECT of other user's data

- **WHEN** a query runs with `app.user_id` set to user A
- **THEN** rows owned by user B are not returned

### Scenario: RLS blocks UPDATE of other user's data

- **WHEN** an UPDATE targets a row owned by user B while `app.user_id` is user A
- **THEN** the UPDATE affects zero rows

### Scenario: RLS blocks DELETE of other user's data

- **WHEN** a DELETE targets a row owned by user B while `app.user_id` is user A
- **THEN** the DELETE affects zero rows
