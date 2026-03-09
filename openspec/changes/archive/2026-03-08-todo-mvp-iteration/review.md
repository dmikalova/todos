# Summary

The plan is well-scoped and grounded in the actual codebase. The model
simplification (context on project, not task) is the right call. All review
findings have been resolved and incorporated into the design and specs. No open
items remain — ready for task generation.

## Security

- [x] **Input validation is already in place** - Zod schemas on all routes, UUID
      validation on IDs. No new attack surface from context/project changes.
- [x] **Auth middleware covers all routes** - `src/middleware.ts` gates the API.
      Context/project changes don't bypass this.
- [x] **Resource ownership validation on all mutations** - All routes that
      accept resource IDs (contextId, projectId, parentProjectId) MUST verify
      the referenced resource belongs to the authenticated user.
      `syncTaskContexts` currently trusts submitted context UUIDs without
      ownership checks. **Address: add `assertOwnership` helper; apply to all
      resource ID inputs in tasks, projects, and context routes.**

## Patterns

- [x] **`syncTaskContexts` pattern** - the delete-then-reinsert pattern for join
      table sync is already in `tasks.ts`. Projects use a direct `context_id` FK
      column (no join table) - just a direct UPDATE.
- [x] **`getContextWithWindows` helper pattern** - all new context-related
      queries follow the existing helper in `src/routes/contexts.ts`. No inline
      context+window fetches. **Address: documented in design decisions.**
- [x] **Frontend store follows fetch-then-notify pattern** - all new store
      methods follow the existing
      `async method → api() → this._field = result → notify()` pattern.
- [x] **`context_id` is currently on tasks in the schema** - the store's `Task`
      interface has `context_id?: string` and `context_ids?: string[]`.
      **Address: migration drops both DB fields and removes from TypeScript
      interfaces and all callers. Documented in migration plan.**

## Alternatives

- [x] **Infinite scroll uses IntersectionObserver** - watching a sentinel
      element at the bottom of the list. No scroll event listeners. **Address:
      documented in design decisions.**
- [x] **Project context inheritance traversal** - client-side recursive lookup
      in the store. No DB recursive CTE needed at MVP. **Address: documented in
      design decisions.**

## Simplifications

- [x] **Remove `/api/contexts/current` endpoint** - redundant with client-side
      window evaluation. **Address: remove endpoint and its integration tests.**
- [x] **Remove server-side context detection from `/api/next`** - the Next
      pipeline is fully client-side. Backend `/api/next` scoring endpoint may be
      simplified or removed. **Address: documented in migration plan.**
- [x] **`context_id` on tasks schema** - tasks currently store `context_id`
      (single) AND a `task_contexts` join table. Both are dropped. Current data
      is test data only - no data preservation needed. **Address: migration plan
      step 1.**

## Missing Considerations

- [x] **Migration for existing task_contexts data** - current data is test data
      only; no data preservation required. Schema change applied directly.
- [x] **`task_count` on projects is not currently filtered** -
      `GET /api/projects` task_count subquery must filter
      `WHERE completed_at IS NULL`. **Address: migration plan step 6.**
- [x] **Frontend test tooling not specified** - must be decided and set up as
      first task before any component tests are written.
- [x] **History view `fetchHistory()` has no pagination** - replaced with
      initial 100 + `fetchMoreHistory` paginated approach. **Address: migration
      plan step 8.**
- [x] **Error state for infinite scroll** - history fetch-more shows error and
      retry on failure. **Address: migration plan step 9.**

## Valuable Additions

- [x] **Loading indicator at bottom of history list** - spinner while next page
      is fetching. **Address: migration plan step 9.**
- [ ] **Empty state for Next view** - "no active context right now" empty state.
      **Defer: MVP+1.**
- [ ] **Context color swatch in project list** - visual association of project
      to context. **Defer: polish pass after MVP.**

## Action Items

All items have been incorporated into the design and specs. See design.md
Migration Plan for the ordered implementation steps.

## Deferred Items

- Empty state for Next view when no active context
- Context color swatch in project list

## Updates Required

All updates have been applied:

- Design decisions updated: `assertOwnership` helper, `IntersectionObserver`,
  context helper pattern, client-side traversal, `/api/contexts/current`
  removal, `/api/next` simplification
- Migration plan updated: simplified (no data preservation), ordered
  implementation steps
- Specs added: `resource-ownership`
