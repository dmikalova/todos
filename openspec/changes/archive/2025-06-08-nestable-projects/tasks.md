# Nestable Projects: Tasks

## 1. Store: Project Tree Computation

- [x] 1.1 Add `projectTree` computed getter to the store that builds a
      depth-annotated flat list from the projects array, sorting siblings
      alphabetically by name within each parent group, filtering out children of
      collapsed parents
- [x] 1.2 Add `getDescendantIds(projectId)` helper to the store that returns all
      recursive descendant project IDs (used by parent selector and backend
      validation)
- [x] 1.3 Add collapsed state management — `collapsedProjectIds` Set persisted
      to localStorage, `toggleCollapse(projectId)` action, restore on init

## 2. Backend: Circular Reference Prevention

- [x] 2.1 Add circular reference validation to PATCH /api/projects/:id — reject
      `parentProjectId` set to self or any descendant with 400 Bad Request

## 3. Frontend: Parent Project Selector

- [x] 3.1 Add parent project dropdown to `project-form.ts` — lists all user
      projects except self and descendants, submits `parentProjectId`
- [x] 3.2 Support clearing parent (move to top level) via a "None" option in the
      dropdown

## 4. Frontend: Sidebar Tree Rendering

- [x] 4.1 Update `todo-sidebar.ts` to render projects using `projectTree` getter
      with left-padding based on depth (cap visual indentation at 4 levels)

## 5. Frontend: Collapsible Tree Nodes

- [x] 5.1 Add expand/collapse toggle icon on parent projects in the sidebar —
      clicking toggles `store.toggleCollapse(projectId)`, projects with no
      children have no toggle
- [x] 5.2 Ensure `projectTree` getter respects collapsed state — children of
      collapsed parents are excluded from the rendered list

## 6. Frontend: Drag-and-Drop Re-parenting

- [x] 6.1 Add HTML5 drag-and-drop to sidebar project items — `draggable`,
      `dragstart`, `dragover`, `drop` event handlers
- [x] 6.2 Implement re-parent on drop onto a project — call PATCH to update
      `parentProjectId`, prevent circular drops (reject drop onto
      self/descendants)
- [x] 6.3 Implement drop to top-level area — clear `parentProjectId` on drop
- [x] 6.4 Add visual feedback during drag — highlight drop target area

## 7. Frontend: Inherited Context Indicator

- [x] 7.1 Update `project-form.ts` context selector to show inherited context
      name as placeholder text (e.g., "inherited: morning") when no direct
      context is set but one is inherited from an ancestor via
      `resolveProjectContext`

## 8. Unit Tests: Project Nesting

- [ ] 8.1 Add unit tests for `projectTree` — correct depths, children after
      parent, alphabetical sibling sort, max depth visual cap
- [ ] 8.2 Add unit tests for `getDescendantIds` — single child, multi-level
      descendants, no descendants returns empty
- [ ] 8.3 Add unit tests for collapse state — collapsed parent hides subtree,
      expand reveals subtree, nested collapse behavior

## 9. Integration Tests: Project Nesting

- [ ] 9.1 Add integration test: create nested project via POST with
      `parentProjectId`, verify response
- [ ] 9.2 Add integration test: circular reference prevention — PATCH setting
      parent to self returns 400, PATCH setting parent to descendant returns 400
- [ ] 9.3 Add integration test: delete parent project orphans children
      (`parent_project_id` set to null)

## 10. Coverage: middleware.ts

- [ ] 10.1 Add integration tests for auth middleware edge cases — missing
      cookie, invalid JWT, expired token, missing subject/audience/issuer in JWT
- [ ] 10.2 Add integration tests for rate limiting — rate limit exceeded path,
      rate limit reset after window
- [ ] 10.3 Add integration tests for dev mode bypass path
      (`DENO_ENV=development`)
- [ ] 10.4 Add tests for JWKS fetch failure paths — response not ok, no keys, no
      ES256 key found

## 11. Coverage: routes/contexts.ts

- [ ] 11.1 Add integration tests for context update edge cases — partial
      updates, clearing color field, removing all time windows
- [ ] 11.2 Add integration tests for context delete cascade — projects with
      deleted context get `context_id` set to null
- [ ] 11.3 Add integration tests for context not found paths — GET/PATCH/DELETE
      with non-existent ID

## 12. Coverage: routes/export.ts

- [ ] 12.1 Add integration tests for all export endpoints — GET /api/export
      (full), /api/export/tasks, /api/export/projects, /api/export/contexts
- [ ] 12.2 Add integration tests for CSV format output and CSV escaping of
      special characters
- [ ] 12.3 Add integration tests for export with filters and recurrence
      enrichment

## 13. Coverage: routes/filters.ts

- [ ] 13.1 Add integration tests for saved filter CRUD — create, list, get,
      update, delete
- [ ] 13.2 Add integration tests for filter apply endpoint — POST
      /api/filters/:id/apply with various criteria combinations
- [ ] 13.3 Add integration tests for filter update with partial criteria and
      null values

## 14. Coverage: routes/history.ts

- [ ] 14.1 Add integration tests for paginated history — GET /api/history with
      pagination params
- [ ] 14.2 Add integration tests for task-specific history — GET
      /api/history/task/:taskId
- [ ] 14.3 Add integration tests for history stats — GET /api/history/stats with
      various date ranges and time periods
- [ ] 14.4 Add integration tests for history filtering with combined filters and
      date ranges

## 15. Coverage: routes/import.ts

- [ ] 15.1 Add integration tests for full import — POST /api/import with merge
      mode including projects, contexts with time windows, tasks with recurrence
- [ ] 15.2 Add integration tests for replace mode import
- [ ] 15.3 Add integration tests for simple task import — POST /api/import/tasks
- [ ] 15.4 Add integration test for Todoist stub — POST /api/import/todoist
      returns 501
- [ ] 15.5 Add integration tests for import error handling — invalid data,
      partial failures (207 status)

## 16. Coverage: routes/projects.ts

- [ ] 16.1 Add integration tests for project ownership validation failures —
      invalid `contextId`, invalid `parentProjectId` return 403
- [ ] 16.2 Add integration tests for inbox endpoint — GET /api/projects/inbox
- [ ] 16.3 Add integration tests for project delete re-parenting — child
      projects get `parent_project_id` set to null

## 17. Coverage: routes/recurrence.ts

- [ ] 17.1 Add integration tests for recurrence CRUD — create, get, update,
      delete rules
- [ ] 17.2 Add integration tests for recurrence validation failures — invalid
      rule, invalid UUID, task not found
- [ ] 17.3 Add integration tests for recurrence completion — POST
      /api/recurrence/:taskId/complete
- [ ] 17.4 Add integration tests for creating rule when one already exists

## 18. Coverage: routes/tasks.ts

- [ ] 18.1 Add integration tests for task ownership validation failures —
      invalid `projectId` returns 403
- [ ] 18.2 Add integration tests for task complete/uncomplete edge cases —
      already completed, not completed, with recurrence
- [ ] 18.3 Add integration tests for task defer with various preset options
- [ ] 18.4 Add integration tests for task not found paths and update validation
      failures

## 19. Coverage: routes/next.ts

- [ ] 19.1 Add integration tests for next endpoint filtering by `projectId`
- [ ] 19.2 Add integration tests for next endpoint query validation failures
- [ ] 19.3 Add integration tests for next with deferred tasks and due date edge
      cases, empty result set

## 20. Coverage: services/history.ts

- [ ] 20.1 Add unit or integration tests for `logTaskAction` — verify history
      entries are created with correct action, userId, taskId, and details
- [ ] 20.2 Add tests for `logTaskActionTx` — verify history logging within a
      transaction

## 21. Coverage: services/ownership.ts

- [ ] 21.1 Add unit tests for `assertOwnership` — 404 for non-existent
      resources, 403 for forbidden access, all table types in switch
- [ ] 21.2 Add unit test for invalid table name (default case)

## 22. Coverage: services/recurrence.ts

- [ ] 22.1 Add unit tests for recurrence edge cases — completion-based missing
      `days_after_completion`, fixed missing frequency, unknown frequency
- [ ] 22.2 Add unit tests for month overflow handling (e.g., Jan 31 → Feb 28)
      and year boundary in weekly calculation
- [ ] 22.3 Add unit tests for validation error messages for each rule type

## 23. Coverage: services/scoring.ts

- [ ] 23.1 Add unit tests for any remaining untested branches in scoring service
      to reach 100%

## 24. Coverage: app.ts and main.ts

- [ ] 24.1 Ensure integration tests exercise `app.ts` and `main.ts` entry paths
      — verify app starts and serves requests (may already be covered by
      existing integration test setup)

## 25. Coverage Verification

- [ ] 25.1 Run `deno test --coverage` and verify all `src/` files report 100%
      line and branch coverage
