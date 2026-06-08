# Context System Redesign: Tasks

## 1. Schema Migration

- [x] 1.1 Create `project_contexts` join table (`project_id`, `context_id`,
      composite PK, ON DELETE CASCADE on both FKs, index on `context_id`)
- [x] 1.2 Create `task_contexts` join table (`task_id`, `context_id`, composite
      PK, ON DELETE CASCADE on both FKs, index on `context_id`)
- [x] 1.3 Write data migration: INSERT into `project_contexts` from projects
      where `context_id IS NOT NULL`
- [x] 1.4 Drop `context_id` column from `projects` table
- [x] 1.5 Drop `must_do` column from `tasks` table
- [x] 1.6 Add `next_task_id` column to a user-level table (or create a
      `user_next_selection` table) for stable Next selection persistence

## 2. Backend: Project Context CRUD

- [x] 2.1 Update `POST /api/projects` to accept `contextIds: string[]` and
      insert into `project_contexts` join table (validate each context belongs
      to the authenticated user via `assertOwnership`)
- [x] 2.2 Update `PATCH /api/projects/:id` to accept `contextIds: string[]` —
      replace existing `project_contexts` rows (delete old, insert new)
- [x] 2.3 Update `GET /api/projects` to return `context_ids: string[]` per
      project (LEFT JOIN on `project_contexts`, aggregate to array)
- [x] 2.4 Remove all `context_id` single-field handling from project routes

## 3. Backend: Task Context CRUD

- [x] 3.1 Update `POST /api/tasks` to accept optional `contextIds: string[]` and
      insert into `task_contexts` join table (validate ownership)
- [x] 3.2 Update `PATCH /api/tasks/:id` to accept optional
      `contextIds: string[]` — replace existing `task_contexts` rows
- [x] 3.3 Update `GET /api/tasks` to return `context_ids: string[]` per task
      (LEFT JOIN on `task_contexts`, aggregate to array)
- [x] 3.4 Remove `must_do` from task create/update request schemas and responses

## 4. Backend: Context Task Resolution Endpoint

- [x] 4.1 Implement `GET /api/contexts/:id/tasks` using recursive CTE that
      resolves effective context membership (direct task contexts + inherited
      via project tree). Accept query params for completion filter
- [x] 4.2 Add ownership validation: context must belong to authenticated user
- [x] 4.3 Sort results by priority desc, due date asc (nulls last), title asc

## 5. Backend: Next Endpoint Redesign

- [x] 5.1 Implement active context evaluation — query `context_time_windows`
      against current timestamp to find active context IDs for the user
- [x] 5.2 Implement rank-ordered context iteration — sort active contexts by
      `sort_order` ascending, iterate from highest rank
- [x] 5.3 For each active context (by rank), query eligible tasks using CTE (not
      completed, not deleted, not deferred past now, effective context matches)
- [x] 5.4 Implement priority grouping + random selection — group eligible tasks
      by priority (p1 > p2 > p3), pick random from highest group
- [x] 5.5 Implement stable selection — persist selected `next_task_id`, return
      existing selection if still eligible, re-select only on complete/defer
- [x] 5.6 Implement fallback across contexts — if no eligible tasks in
      highest-ranked context, try next-ranked; return empty if all exhausted
- [x] 5.7 Remove scoring service (`services/scoring.ts`) and all references

## 6. Backend: Context Rank Management

- [x] 6.1 Implement `PATCH /api/contexts/reorder` endpoint — accept ordered
      array of context IDs, update `sort_order` values to match position
- [x] 6.2 Ensure new contexts get `sort_order` appended at end (max + 1)

## 7. Frontend: Project Form Context Multi-Select

- [x] 7.1 Replace single context dropdown in `project-form` with a multi-select
      context picker that submits `contextIds: string[]`
- [x] 7.2 Pre-populate multi-select with project's current `context_ids` on edit
- [x] 7.3 Show inherited context names as placeholder hint when project has no
      direct contexts but inherits from ancestor

## 8. Frontend: Task Form Context Picker

- [x] 8.1 Add optional multi-select context picker to task create/edit form
- [x] 8.2 Show inherited (project) contexts as placeholder hint when task has no
      direct contexts
- [x] 8.3 Remove `must_do` checkbox from task form

## 9. Frontend: Context Navigation View

- [x] 9.1 Make contexts in the sidebar clickable — navigate to a context task
      list view
- [x] 9.2 Implement context task list view fetching from
      `GET /api/contexts/:id/tasks` with same layout as project view
- [x] 9.3 Add done/all/next toggle to context view (filters by completion
      status)
- [x] 9.4 Display tasks sorted by priority desc, due date asc, title

## 10. Frontend: Context Rank Reordering

- [x] 10.1 Add drag-and-drop reordering for contexts in the sidebar — call
      `PATCH /api/contexts/reorder` on drop
- [x] 10.2 Add up/down controls in context editor for rank adjustment

## 11. Frontend: Next View Update

- [x] 11.1 Update Next view to fetch from redesigned `GET /api/next` endpoint
- [x] 11.2 Display single task with stable selection (no client-side filtering)
- [x] 11.3 Show empty state when no active contexts have eligible tasks
- [x] 11.4 Remove all `must_do` references from frontend (store, components,
      types)

## 12. Frontend: Store Cleanup

- [x] 12.1 Remove `resolveProjectContext` and client-side context resolution
      logic from store
- [x] 12.2 Update store to use `context_ids: string[]` arrays instead of single
      `context_id` on projects
- [x] 12.3 Remove scoring-related code from frontend (if any)

## 13. Tests: Schema and Migration

- [x] 13.1 Add integration test: verify `project_contexts` and `task_contexts`
      join tables exist with correct constraints and cascades
- [x] 13.2 Add integration test: verify `must_do` column no longer exists
- [x] 13.3 Add integration test: verify `context_id` column no longer exists on
      projects

## 14. Tests: Project Context CRUD

- [x] 14.1 Add integration test: create project with multiple contexts, verify
      response includes `context_ids` array
- [x] 14.2 Add integration test: update project contexts (replace), verify old
      contexts removed and new ones set
- [x] 14.3 Add integration test: ownership validation — reject context IDs
      belonging to another user with 403

## 15. Tests: Task Context CRUD

- [x] 15.1 Add integration test: create task with contexts, verify response
- [x] 15.2 Add integration test: update task contexts (replace)
- [x] 15.3 Add integration test: ownership validation for task context IDs

## 16. Tests: Context Task Resolution

- [x] 16.1 Add integration test: `GET /api/contexts/:id/tasks` returns tasks
      with direct context assignment
- [x] 16.2 Add integration test: returns tasks inheriting context from project
- [x] 16.3 Add integration test: excludes tasks with own contexts that don't
      include the queried context (override behavior)
- [x] 16.4 Add integration test: multi-level project inheritance (grandchild
      inherits from grandparent when parent has no contexts)

## 17. Tests: Next Endpoint

- [x] 17.1 Add integration test: Next returns task from highest-ranked active
      context
- [x] 17.2 Add integration test: stable selection — same task returned on
      repeated calls until completed/deferred
- [x] 17.3 Add integration test: re-selection on complete — new random task from
      highest priority group
- [x] 17.4 Add integration test: fallback to next-ranked context when
      highest-ranked has no eligible tasks
- [x] 17.5 Add integration test: empty response when no active contexts have
      eligible tasks
- [x] 17.6 Add integration test: deferred tasks excluded until deferred_until
      passes

## 18. Tests: Context Rank

- [x] 18.1 Add integration test: reorder contexts, verify `sort_order` updated
- [x] 18.2 Add integration test: new context gets highest sort_order (last)
