# Context

The todos app has a data model that includes tasks, projects, contexts, and
windows. The revised model (agreed in design review):

- **Contexts** are named, reusable labels (e.g., "morning", "evening", "free
  time") shared across projects
- **Windows** are recurring schedules on a context (e.g., Mon–Fri 9–12, every
  evening 19–22) — not one-off time ranges
- **Projects** are assigned to a context. Nested projects inherit the nearest
  ancestor's context if none is explicitly set
- **Tasks** have no direct context — they inherit implicitly through their
  project

This means updating a context's windows automatically affects all projects (and
their tasks) that use it, with no per-task changes needed.

Current bugs: context assignment is not working correctly on the project form.
Windows have been modeled but not exercised end-to-end. The Next view queries
all tasks rather than filtering by context/window. The sidebar uses mixed-case
labels. Project task counts include done tasks instead of only open tasks. All
tasks (including completed) are loaded on startup with no pagination or cap.

Testing is sparse — no systematic backend unit tests for context/window logic,
and no frontend component tests for the project form, sidebar, or Next view.

## Goals / Non-Goals

**Goals:**

- Redesign context assignment: contexts live on projects (not tasks), with
  inheritance for nested projects
- Remove context from tasks entirely
- Fix project task count: show only open (incomplete) tasks
- Bound task loading: open tasks load fully; done tasks load as capped history
  (1000, ordered by completion date descending)
- Verify and fix windows: recurring schedule evaluation (days-of-week + time
  range) works correctly
- Fix Next view: pipeline is active windows → contexts → projects → tasks
- Achieve 100% test coverage across all `src/` files; add new unit tests
  (`next_pipeline_test.ts`, `project_task_count_test.ts`,
  `task_loading_test.ts`, `store_test.ts`); update existing integration tests;
  add frontend component tests for sidebar, project form context selector, and
  history infinite scroll
- Lowercase all sidebar/nav labels and document this as a project tenet

**Non-Goals:**

- One-off (non-recurring) windows — all windows are recurring schedules
- Full e2e browser automation tests (out of scope for this iteration)
- Allowing tasks to override their project's context

## Decisions

### Context is set on projects, not tasks

**Decision:** Tasks have no `context_id`. Context is set on a project (many
projects can share one named context). Tasks in a project implicitly belong to
that context.

**Rationale:** A task's context is determined by what you're working on (the
project), not the task itself. Shared named contexts mean updating a window
schedule propagates everywhere automatically.

**Alternative considered:** Task-level context assignment (many-to-many).
Rejected — over-engineered for how tasks are actually used; the user could not
identify a real case where a task needs multiple or different contexts from its
project.

---

### Nested projects inherit context from nearest ancestor

**Decision:** If a project has no context set, it inherits the context from its
parent project, walking up the tree until a context is found. If no ancestor has
a context, the project/tasks are context-less and do not appear in Next.

**Rationale:** Mirrors real-world usage — sub-projects naturally belong to the
same context as their parent. Avoids requiring repeated context assignment on
every nested project.

---

### Windows are recurring schedules

**Decision:** A window is defined as
`{ days: ["mon","tue","wed","thu","fri"], start: "09:00", end: "12:00" }` in
local time. A window is active if today's day-of-week matches and current local
time is within start–end.

**Rationale:** "Every weekday morning" is a stable, recurring intention — not a
one-off appointment. Recurring schedules require no maintenance once set.

---

### Window evaluation is client-side

**Decision:** The client evaluates which windows are currently active using the
device's local clock. With Supabase realtime, context/window data is always
fresh on the client.

**Rationale:** Supabase realtime keeps the client in sync; server-side
evaluation adds latency and complexity with no benefit. Local time is also
correct for the user's actual schedule.

---

### Next view pipeline: active windows → contexts → projects → tasks

**Decision:** The Next view computes:

1. Evaluate all windows client-side → collect active contexts
2. Find all projects assigned to (or inheriting) an active context
3. Return incomplete tasks belonging to those projects, ordered by due date
   ascending (undated last)

**Rationale:** Directly maps the GTD "Next Actions" model — surface tasks you
can act on right now given your current context.

---

### Dual-layer ownership validation: RLS + application-level checks

**Decision:** Ownership is enforced at two layers:

1. **Postgres Row Level Security (RLS):** Every table gets a `user_id` column
   (NOT NULL, no default). RLS policies restrict all operations to
   `WHERE user_id = current_setting('app.user_id')`. This is the security
   backstop — even a buggy route cannot leak or mutate another user's data.
2. **Application-level `assertOwnership`:** Routes that accept resource IDs
   (contextId, projectId, parentProjectId) call
   `assertOwnership(sql, table, id, userId)` before use. This provides clear
   HTTP error responses: 403 for foreign IDs, 404 for non-existent IDs.

The app sets the Postgres session variable `app.user_id` via `SET LOCAL` at the
start of each request (inside the transaction that Supavisor provides). This
makes RLS work with the direct postgres.js connection and transaction pooler.

**Rationale:** RLS is defense-in-depth at the database layer — impossible to
accidentally bypass. Application-level checks provide actionable HTTP status
codes and error messages that RLS silently swallows (RLS just returns empty
results or silently blocks writes). Both layers together give security +
usability.

**Schema impact:** All 8 tables need a `user_id` column added. Current data is
test data — backfill with a constant test user ID or re-seed.

---

### Lowercase labels enforced via constants/i18n

**Decision:** All sidebar label strings are defined in a single constants or
i18n file. Labels MUST NOT be hardcoded inline in templates.

**Rationale:** Single source of truth prevents drift; easy to audit and enforce
as a project tenet.

---

### Infinite scroll uses IntersectionObserver

**Decision:** The history view infinite scroll is implemented using the
browser's `IntersectionObserver` API watching a sentinel element at the bottom
of the list.

**Rationale:** `IntersectionObserver` is the idiomatic approach for
scroll-to-load in web components - no scroll event listeners, no debouncing, and
it works correctly inside any scroll container.

---

### Context route helpers used consistently

**Decision:** All new context-related queries follow the existing
`getContextWithWindows(sql, contextId)` helper pattern. No new context queries
fetch context and windows separately inline.

**Rationale:** The pattern already exists in `src/routes/contexts.ts`.
Consistent use prevents divergence and keeps queries readable.

---

### Task loading: open tasks fully loaded, done tasks capped at 100

**Decision:** On startup, the client loads all open (incomplete) tasks. Done
tasks are loaded as an initial batch of 100 records (most recently completed
first). The history view supports infinite scroll — scrolling to the end fetches
the next batch of completed tasks on demand.

**Rationale:** Open tasks must all be available for Next, inbox, and project
views. 100 done tasks covers recent history without a heavy initial load.
Infinite scroll in history gives access to the full archive without upfront
cost.

**Alternative considered:** Pagination for all tasks. Rejected for MVP — open
tasks need to be fully available client-side for the Next view pipeline to work
without extra round-trips.

---

### Project task count shows only open tasks

**Decision:** The task count displayed on a project shows only incomplete tasks.
Done tasks are excluded.

**Rationale:** The count communicates remaining work, not total historical
tasks. Including done tasks inflates the number in a misleading way.

## Risks / Trade-offs

- [Risk] Schema migration drops `task_contexts` table and `tasks.context_id`
  column - current data is test data only so no preservation is needed; just
  apply the schema change directly
- [Risk] Adding `user_id` NOT NULL to all tables requires backfilling existing
  rows — current data is test data, backfill with a constant test user ID or
  re-seed
- [Risk] RLS with Supavisor transaction pooler requires `SET LOCAL` inside each
  transaction — middleware must reliably set `app.user_id` before any query runs
- [Risk] Context inheritance requires a tree traversal → Mitigation: projects
  are unlikely to be deeply nested; a simple recursive lookup in the store is
  sufficient at MVP
- [Risk] Client-side window evaluation uses local device clock → Mitigation:
  this is intentional (user's local schedule), document it clearly
- [Risk] Capping initial done tasks at 100 means older completed tasks aren't
  immediately available → Mitigation: infinite scroll in history view loads them
  on demand
- [Risk] Test coverage gap may uncover additional bugs → Mitigation: file as
  follow-up tasks; don't block MVP

## Migration Plan

Current data is test data only — no data preservation is required. Apply schema
changes directly.

1. Drop `task_contexts` table and `tasks.context_id` column; remove
   `context_ids` from TypeScript `Task` interface and all callers
2. Add `context_id` (nullable FK) and `parent_project_id` (nullable FK) to
   `projects` table
3. Remove `/api/contexts/current` endpoint and its tests
4. Simplify `/api/next` — remove server-side context detection; client handles
   the pipeline
5. Add `user_id` NOT NULL column to all tables; backfill test data with a
   constant user ID
6. Enable RLS on all tables; create
   `USING (user_id = current_setting('app.user_id'))` policies
7. Add middleware to set `SET LOCAL app.user_id` at the start of each request
8. Add `assertOwnership` helper; apply to all resource ID inputs in tasks,
   projects, context routes
9. Fix `task_count` subquery in `GET /api/projects` to
   `WHERE completed_at IS NULL`
10. Fix project form context selector — save and load `context_id` correctly
11. Update store `fetchHistory` to load initial 100 completed tasks; add
    `fetchMoreHistory` for paginated loading
12. Add `IntersectionObserver`-based infinite scroll to history view with
    loading indicator and error/retry state
13. Implement recurring window model and client-side active evaluation
14. Implement client-side context inheritance traversal for nested projects
15. Update Next view to use the new pipeline
16. Update all sidebar label strings to lowercase
17. Deploy

## Open Questions

- ~~Should tasks with no project (inbox tasks) ever appear in Next?~~
  **Resolved:** No. Tasks with no project belong to the inbox and never appear
  in Next.
