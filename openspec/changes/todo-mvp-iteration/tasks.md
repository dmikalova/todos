# Todo MVP Iteration: Tasks

## 1. Schema Migration — Context Model

- [x] 1.1 Drop `task_contexts` join table
- [x] 1.2 Drop `context_id` column from `tasks` table
- [x] 1.3 Add `context_id` (nullable FK to contexts) on `projects` table
- [x] 1.4 Add `parent_project_id` (nullable self-FK) on `projects` table
- [x] 1.5 Remove `context_id` and `context_ids` from TypeScript `Task` interface
      and all callers

## 2. Schema Migration — User Ownership & RLS

- [x] 2.1 Add `user_id` UUID NOT NULL column to all tables (projects, contexts,
      context_time_windows, tasks, recurrence_rules, saved_filters,
      task_history)
- [ ] 2.2 Backfill existing test data with a constant test user ID
- [ ] 2.3 Enable RLS on all tables
- [ ] 2.4 Create RLS policies on each table: SELECT/INSERT/UPDATE/DELETE
      restricted to `user_id = current_setting('app.user_id')::uuid`
- [ ] 2.5 Verify INSERT policy enforces `user_id` matches session (prevent
      spoofing user_id in INSERT)

## 3. Backend — Request-Scoped User ID

- [x] 3.1 Add middleware (or per-request wrapper) that executes
      `SET LOCAL app.user_id = '<userId>'` before route handlers run
- [x] 3.2 Ensure all database queries run within the transaction where
      `app.user_id` is set
- [x] 3.3 Update all INSERT queries to set `user_id` from the authenticated
      session

## 4. Backend — Application-Level Ownership Validation

- [x] 4.1 Create shared `assertOwnership(sql, table, id, userId)` helper that
      returns 403 for foreign IDs and 404 for non-existent IDs
- [x] 4.2 Apply `assertOwnership` to task routes (`projectId` on create/update)
- [x] 4.3 Apply `assertOwnership` to project routes (`contextId`,
      `parentProjectId` on create/update)
- [x] 4.4 Apply `assertOwnership` to context routes (context ID on
      update/delete)
- [x] 4.5 Remove `syncTaskContexts` function and its ownership-unchecked context
      ID handling

## 5. Backend — Project & Task Route Updates

- [x] 5.1 Update project CRUD routes to accept and persist `context_id`
- [x] 5.2 Update project CRUD routes to accept and persist `parent_project_id`
- [x] 5.3 Fix `task_count` subquery in `GET /api/projects` to filter
      `WHERE completed_at IS NULL`
- [x] 5.4 Update `GET /api/tasks` to support `completed` filter and
      `limit`/`offset` pagination params
- [x] 5.5 Remove context-related fields from task create/update request schemas

## 6. Backend — Endpoint Cleanup

- [x] 6.1 Remove `/api/contexts/current` endpoint and its route handler
- [x] 6.2 Simplify `/api/next` — remove server-side context detection logic
      (client handles the pipeline)

## 7. Frontend — Store & Data Model

- [x] 7.1 Remove `context_id`/`context_ids` from client-side `Task` type and all
      references
- [x] 7.2 Add `context_id` and `parent_project_id` to client-side `Project` type
- [x] 7.3 Update `fetchTasks` to load all open tasks (no cap)
- [x] 7.4 Add `fetchHistory` to load initial 100 completed tasks ordered by
      `completed_at` desc
- [x] 7.5 Add `fetchMoreHistory(offset, pageSize)` for paginated loading of
      additional completed tasks

## 8. Frontend — Context Inheritance & Window Evaluation

- [x] 8.1 Implement `resolveProjectContext(project, projects)` — walk ancestors
      to find nearest context
- [x] 8.2 Implement `isWindowActive(window, now)` — compare days-of-week and
      HH:MM time range against local clock
- [x] 8.3 Implement `getActiveContextIds(contexts, now)` — return context IDs
      with at least one active window

## 9. Frontend — Next View Pipeline

- [x] 9.1 Implement `getNextProjects(projects, activeContextIds)` — filter
      projects by effective active context
- [x] 9.2 Implement `filterNextTasks(tasks, nextProjectIds)` — return incomplete
      tasks in next projects, excluding inbox tasks
- [x] 9.3 Implement `sortNextTasks(tasks)` — sort by due date ascending, undated
      last
- [x] 9.4 Update Next view component to use client-side pipeline instead of
      backend `/api/next`

## 10. Frontend — Project Form

- [x] 10.1 Add context selector dropdown to project form showing all available
      contexts
- [x] 10.2 Pre-populate context selector with current `context_id` when editing
      existing project
- [x] 10.3 Submit selected `contextId` on project save

## 11. Frontend — History View Infinite Scroll

- [x] 11.1 Add sentinel element at the bottom of the history task list
- [x] 11.2 Wire `IntersectionObserver` to sentinel to trigger `fetchMoreHistory`
      on scroll-to-bottom
- [x] 11.3 Add loading indicator (spinner) while next page is fetching
- [x] 11.4 Add error state with retry button on fetch failure
- [x] 11.5 Stop fetching when last batch returns fewer items than page size

## 12. Frontend — UI Label Conventions

- [x] 12.1 Create a central label constants/i18n file for sidebar and navigation
      strings
- [x] 12.2 Update sidebar component to source all labels from the constants file
- [x] 12.3 Verify all labels are lowercase (e.g., "add task", "inbox", "next",
      "due", "history", "settings")

## 13. Unit Tests

- [ ] 13.1 Add window evaluation edge cases to `context_matching_test.ts`
      (multi-day windows, inheritance: nearest ancestor wins, direct beats
      ancestor, no ancestor context)
- [ ] 13.2 Create `next_pipeline_test.ts` — test `getActiveContextIds`,
      `getNextProjects` (including inherited context), `sortNextTasks`, and
      inbox exclusion
- [ ] 13.3 Create `project_task_count_test.ts` — test open-only count and
      zero-count when all done
- [ ] 13.4 Create `task_loading_test.ts` — test initial load params and infinite
      scroll offset advancement
- [ ] 13.5 Create `store_test.ts` — test `inboxTasks`, `inboxCount`,
      `projectTasks`, `dueTasks`, and `currentPageTitle` computed properties

## 14. Integration Tests

- [ ] 14.1 Add/update `context_test.ts` — POST creates with windows, PATCH
      replaces windows, DELETE cascades, GET returns windows
- [ ] 14.2 Add/update `project_test.ts` — POST with `contextId`, PATCH updates
      `contextId`, `task_count` excludes completed, nested `parentProjectId`
- [ ] 14.3 Update `task_test.ts` — remove context round-trip tests, add
      `completed` filter and `limit`/`offset` pagination tests
- [ ] 14.4 Update `next_test.ts` — tasks from projects with active context
      returned, inactive context excluded, inbox tasks excluded
- [ ] 14.5 Add ownership validation integration tests — verify 403 for foreign
      `contextId`, `projectId`, and `parentProjectId` on relevant routes
- [ ] 14.6 Add RLS integration tests — verify cross-user SELECT/UPDATE/DELETE
      returns zero rows when `app.user_id` differs

## 15. Frontend Component Tests

- [ ] 15.1 Add sidebar component tests — verify all rendered labels are
      lowercase and sourced from constants
- [ ] 15.2 Add context selector component tests — pre-populates on edit, submits
      correct ID
- [ ] 15.3 Add history view infinite scroll tests — scroll triggers load, stops
      when exhausted

## 16. Coverage & Verification

- [ ] 16.1 Run `deno test --coverage` and verify all `src/` files reach 100%
      line and branch coverage
- [ ] 16.2 Fix any coverage gaps found
