# Context System Redesign: Design

## Context

The tasks app currently has:

- A `contexts` table with `id`, `name`, `color`, `sort_order`
- A `context_time_windows` table defining when each context is active
- A single `context_id` FK on the `projects` table (one context per project)
- No context association on tasks — tasks inherit purely from their project
- A `must_do` boolean on tasks that is unused but referenced in specs
- Project hierarchy via `parent_project_id` with context inheritance through
  `resolveProjectContext`

The problem: the single-context-per-project model can't express task-level
context overrides or multi-context assignments. The conflicting specs need
resolution.

## Goals / Non-Goals

**Goals:**

- Multi-context assignment on both projects and tasks via join tables
- CSS-style cascade inheritance (most-specific wins, no explicit "don't inherit"
  flag needed)
- Context priority drives Next ordering when multiple contexts are active
- Context as a clickable navigation view (like projects)
- Remove `must_do` from the system entirely
- Backward-compatible migration (additive schema changes + data migration)

**Non-Goals:**

- Redesigning the Next algorithm (separate future change)
- Labels/tags system (deferred to later)
- Context label-filters (deferred)
- Multi-user/sharing of contexts

## Decisions

### 1. Join tables for multi-context (over array columns or JSON)

**Choice**: `project_contexts(project_id, context_id)` and
`task_contexts(task_id, context_id)` join tables.

**Why over array columns**: Join tables support FK constraints, indexed lookups,
and standard SQL joins. Array columns (`context_ids uuid[]`) can't enforce FK
integrity and require `ANY()` operations that complicate queries.

**Why over JSON**: Same FK and indexing advantages. JSON would require
application-level validation.

### 2. CSS-style cascade with no explicit flag (over inherit/don't-inherit boolean)

**Choice**: Resolution logic is purely: task contexts > project contexts >
ancestor project contexts. If an entity has any contexts in its join table,
those are its contexts. If it has none, look up the tree.

**Why no flag**: A boolean `inherit_context` adds a third state to reason about
("has contexts", "empty and inheriting", "empty and explicitly contextless").
The simpler model: if you want a task to be contextless, don't assign contexts
to it or its project. Contextless = doesn't show in Next but is visible in
project/filter views.

**Trade-off**: A task that truly needs "no context, don't inherit, but still
visible in Next" cannot exist. Per user decision, this is acceptable —
contextless items just don't appear in Next.

### 3. Drop `context_id` from projects (over keeping both)

**Choice**: Remove the `context_id` column from `projects` and migrate existing
data to the `project_contexts` join table.

**Why**: Having both a direct FK and a join table creates confusion about which
is authoritative. Single source of truth via join table only.

**Migration**: INSERT into `project_contexts` for every project that has a
non-null `context_id`, then drop the column.

### 4. Effective context resolution is server-side via Postgres CTE

**Choice**: The backend resolves effective contexts using recursive CTEs in
Postgres. View endpoints (`GET /api/contexts/:id/tasks`, `GET /api/next`) query
for tasks with effective context membership directly.

**Why server-side over client-side**: With potentially thousands of tasks,
loading all tasks on every page load is impractical. Each view (project,
context, next) should query only the relevant tasks. A recursive CTE that walks
the project tree is bounded by tree depth (typically 3-4 levels) and is cheap.

**Resolution query pattern**:

```sql
WITH RECURSIVE ctx_projects AS (
  -- Projects directly assigned context X
  SELECT p.id FROM projects p
  JOIN project_contexts pc ON pc.project_id = p.id
  WHERE pc.context_id = $1 AND p.user_id = $2
  UNION
  -- Child projects that inherit (have no own contexts)
  SELECT child.id FROM projects child
  JOIN ctx_projects parent ON child.parent_project_id = parent.id
  WHERE NOT EXISTS (
    SELECT 1 FROM project_contexts pc WHERE pc.project_id = child.id
  )
)
-- Tasks with direct context
SELECT t.* FROM tasks t
JOIN task_contexts tc ON tc.task_id = t.id
WHERE tc.context_id = $1 AND t.user_id = $2
UNION
-- Tasks inheriting from project (no direct task contexts)
SELECT t.* FROM tasks t
WHERE t.user_id = $2
  AND t.project_id IN (SELECT id FROM ctx_projects)
  AND NOT EXISTS (SELECT 1 FROM task_contexts tc WHERE tc.task_id = t.id)
```

**Frontend role**: The frontend still knows about contexts and projects for
display/navigation purposes, but task lists are fetched from the server with
context resolution already applied.

### 5. Context `sort_order` serves as rank (over user-entered numeric priority)

**Choice**: Reuse the existing `sort_order` column on `contexts` as the rank.
Lower sort_order = higher rank = shown first in Next. Ranks are unique per user
(no two contexts share a sort_order).

**Why positional ordering over numeric input (0-100)**: A numeric field forces
users to understand all existing ranks, creates gaps/conflicts, and doesn't
scale. Positional ordering (drag in sidebar, up/down in editor) is intuitive —
the order you see is the rank. No numbers to remember.

**UI**: Sidebar context list order IS the rank. Context editor shows up/down
controls with neighboring contexts visible for reference. Drag-and-drop in
sidebar reorders ranks.

**Why separate from task priority**: Task priority (p1/p2/p3) is per-task
urgency. Context rank is about which _situation's_ tasks you see first when
multiple windows overlap. They compose: rank picks the group, priority sorts
within it.

### 6. Remove `must_do` and scoring service entirely (over deprecation)

**Choice**: Drop the `must_do` column, remove from all API schemas, frontend,
and specs. Also remove `services/scoring.ts` entirely — Next no longer uses
numerical scoring.

**Why**: `must_do` is unused, and the scoring formula
(`priority_weight +
overdue_days`) is replaced by a simpler precedence system:
context rank → task priority → random. No numerical score is needed.

**Migration**: `ALTER TABLE tasks DROP COLUMN must_do` (acceptable since it's
unused — no data loss).

## Schema Changes

```sql
-- New join tables
CREATE TABLE project_contexts (
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  context_id uuid NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, context_id)
);

CREATE TABLE task_contexts (
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  context_id uuid NOT NULL REFERENCES contexts(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, context_id)
);

-- Indexes for reverse lookups
CREATE INDEX idx_project_contexts_context_id ON project_contexts(context_id);
CREATE INDEX idx_task_contexts_context_id ON task_contexts(context_id);

-- Migration: copy existing data
INSERT INTO project_contexts (project_id, context_id)
SELECT id, context_id FROM projects WHERE context_id IS NOT NULL;

-- Drop old column and must_do
ALTER TABLE projects DROP COLUMN context_id;
ALTER TABLE tasks DROP COLUMN must_do;
```

## API Changes

### Projects API

- `POST /api/projects`: Accept `contextIds: string[]` instead of `contextId`
- `PATCH /api/projects/:id`: Accept `contextIds: string[]`
- `GET /api/projects`: Return `context_ids: string[]` per project (from join)

### Tasks API

- `POST /api/tasks`: Accept optional `contextIds: string[]`
- `PATCH /api/tasks/:id`: Accept optional `contextIds: string[]`
- `GET /api/tasks`: Return `context_ids: string[]` per task (from join)

### Contexts API

- `GET /api/contexts/:id/tasks`: New endpoint — returns all tasks whose
  effective context includes this context (with inheritance resolution
  server-side for this view)

## Frontend Changes

### Context Resolution Function

The frontend no longer resolves effective contexts for filtering. The server
handles this via the recursive CTE pattern in Decision #4. The frontend fetches
pre-filtered task lists from endpoints like:

- `GET /api/contexts/:id/tasks` — tasks with effective context
- `GET /api/next` — next task from highest-ranked active context
- `GET /api/projects/:id/tasks` — tasks in project (already exists)

### Context Navigation View

When user clicks a context in the sidebar:

- Show all tasks whose effective context includes that context
- Display with same layout as project view (task list with edit, complete)
- Top-right toggle: done/all/next (filters completed status)
- Tasks are sorted by priority descending, then due date ascending, then title
  alphabetically

### Next View Pipeline Update

The Next endpoint (`GET /api/next`) implements the following server-side logic:

1. **Evaluate active contexts**: Check `context_time_windows` against current
   time to find active context IDs
2. **Rank ordering**: Sort active contexts by `sort_order` ascending (lowest =
   highest rank)
3. **For the highest-ranked active context**: Query eligible tasks (not
   completed, not deferred, effective context matches) using the CTE pattern
4. **Priority grouping**: Group eligible tasks by priority (p1 > p2 > p3)
5. **Select**: Pick one random task from the highest priority group
6. **Fallback**: If no tasks in highest-ranked context, try next-ranked context
7. **Empty**: If no active contexts have eligible tasks, return empty

The selection is **stable** — once a task is selected, it remains the "next"
task until completed or deferred. A `next_task_id` column or cache stores the
current selection. Re-selection only happens on complete/defer.

```sql
-- Simplified: get eligible tasks for a context, ordered for selection
WITH RECURSIVE ctx_projects AS (...)
SELECT t.* FROM (
  SELECT t.* FROM tasks t
  JOIN task_contexts tc ON tc.task_id = t.id
  WHERE tc.context_id = $1 AND t.user_id = $2
  UNION
  SELECT t.* FROM tasks t
  WHERE t.user_id = $2
    AND t.project_id IN (SELECT id FROM ctx_projects)
    AND NOT EXISTS (SELECT 1 FROM task_contexts tc WHERE tc.task_id = t.id)
) t
WHERE t.completed_at IS NULL
  AND t.deleted_at IS NULL
  AND (t.deferred_until IS NULL OR t.deferred_until <= NOW())
ORDER BY t.priority DESC
```

## Risks / Trade-offs

- **[Risk] Dropping `must_do` column** → Mitigation: Verify it's truly unused in
  production data before migration. If any rows have `must_do = true`, surface
  them to user before dropping.
- **[Risk] Contextless tasks invisible in Next** → Mitigation: This is by
  design. Users must assign contexts to projects/tasks for them to appear in
  Next. The project/filter views still show everything.
- **[Risk] Recursive CTE performance** → Mitigation: The project tree is small
  (dozens per user, max 4 levels deep). The CTE is bounded by tree depth and
  uses indexed FKs. No performance concern at this scale.
- **[Risk] Migration drops `context_id` column** → Mitigation: Data is copied to
  join table first. Migration is a single transaction. No concern about data
  loss since the app is pre-production.
- **[Risk] Removing scoring service** → Mitigation: Next selection is simpler
  (rank → priority → random). The scoring service has no other consumers.

## Open Questions

_All resolved._

- ~~Should the context navigation view support drag-and-drop reordering of
  tasks?~~ **No.** Tasks are sorted by priority > due date > title. No manual
  reordering.
- ~~When viewing a context, should sub-project tasks be grouped by project or
  shown flat?~~ **Flat.** Tasks shown in a single flat list regardless of
  project hierarchy.
