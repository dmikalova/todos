# Todo App: Design

## Context

This is a new personal todo application. No existing codebase - building from
scratch using the established stack (Deno + Hono + Vue.js + PostgreSQL).

The unique "Next" page feature requires a smart selection algorithm that
considers multiple factors (due date, context, priority) to present relevant
tasks.

## Goals / Non-Goals

**Goals:**

- Simple, fast task entry and completion
- Intelligent task presentation via "Next" page
- Flexible recurrence without complexity
- Context-awareness for relevant suggestions
- Single-user, no collaboration features
- Full data ownership via import/export
- Keyboard-driven workflow for power users

**Non-Goals:**

- Multi-user / sharing / collaboration
- Mobile app (web-only, responsive design)
- Integrations with other services (calendar, email)
- Natural language parsing ("do laundry every tuesday")
- Subtasks / task dependencies
- Time tracking
- Full markdown editing (only basic inline formatting)
- WYSIWYG editor or formatting toolbar (users type raw markdown)

## Decisions

### Decision: Database schema with separate recurrence table

**Choice**: Store recurrence rules in a separate `recurrence_rules` table linked
to tasks, rather than embedding in the task record.

**Rationale**: Recurrence rules have different lifecycles than tasks. When a
recurring task is completed, we create a new task instance but keep the same
rule. Separating them makes the completion flow cleaner.

**Alternatives**:

- Embed recurrence in task JSON: Harder to query, mixed concerns
- Chosen approach allows indexing recurrence patterns for batch processing

### Decision: User-defined contexts with multi-select

**Choice**: Contexts are user-defined entities stored in a `contexts` table with
per-day time windows. Tasks have a many-to-many relationship with contexts via
`task_contexts` join table.

**Schema**:

```sql
CREATE TABLE contexts (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE context_time_windows (
  id UUID PRIMARY KEY,
  context_id UUID REFERENCES contexts(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL,  -- 0=Sunday, 6=Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL
);

CREATE TABLE task_contexts (
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  context_id UUID REFERENCES contexts(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, context_id)
);
```

**Default context** (seeded, but user can delete):

- `work`: Mon-Fri (days 1-5) 09:00-17:00

**Tasks without contexts**: Always eligible for Next page (equivalent to
"anytime"). No separate "weekend" context needed.

**Timezone handling**: Client sends local time with each request. Server uses
this to determine active contexts. No server-side timezone storage needed.

**Alternatives**:

- Fixed enum: Users can't customize
- Single context per task: Too limiting when tasks span contexts
- Simple weekdays_only flag: Not flexible enough for varied schedules

### Decision: "Next" page selection algorithm

**Choice**: Score-based selection with weighted randomness from eligible tasks,
present 2.

**Algorithm**:

1. Filter to tasks where: `due_date <= today` OR `due_date IS NULL` (no future
   tasks)
2. Filter to tasks where at least one context is currently active, OR task has
   no contexts
3. Filter out deferred tasks: `deferred_until IS NULL` OR
   `deferred_until <= NOW()`
4. Score each task: `priority_weight + overdue_days + (must_do ? 1000 : 0)`
5. Group tasks by score tier (within 5 points = same tier)
6. Within each tier, randomly select tasks
7. Return 2 tasks from highest-scoring tiers

**Context + defer interaction**: When a task is deferred, it respects context
filtering when the defer expires. If you defer a work task to 6pm, it won't show
until work context is active again (next morning, or manually enter work
context).

**Weighted randomness**: When multiple tasks have similar scores, randomly pick
which ones to show. This ensures variety - if you have 10 medium-priority tasks,
you'll see different ones each time rather than always the same 2.

**Must-do tasks**: Tasks marked `must_do = true` cannot be deferred and always
appear until completed. Used for non-negotiable items (medication, meals).

**Manual context override**: User can manually enter any context from the UI to
see tasks from that context regardless of current time.

**Alternatives**:

- Pure random: Unpredictable, ignores priority
- Strictly deterministic: Same tasks always shown, others never get attention
- Single task: Less choice, users might skip
- More than 2: Decision fatigue

### Decision: Defer actions create schedule adjustments

**Choice**: Deferring a task updates `deferred_until` timestamp, not the due
date.

**Rationale**: Due date represents the original deadline. `deferred_until` is a
temporary snooze. The task reappears after the defer period but still shows as
overdue if past due date.

**Defer options**:

- Later today: +4 hours
- Tomorrow: Next day 9am
- This weekend: Saturday 10am
- Next occurrence: Skip to next recurrence (recurring tasks only)

**Alternatives**:

- Move due date: Loses original deadline information
- Chosen approach preserves accountability

### Decision: Friendly recurrence UI instead of cron

**Choice**: Use structured fields for recurrence instead of cron expressions.

**Schema**:

```sql
CREATE TABLE recurrence_rules (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id),
  schedule_type TEXT NOT NULL, -- 'fixed' or 'completion'

  -- For fixed schedules (schedule_type = 'fixed')
  frequency TEXT,              -- 'daily', 'weekly', 'monthly', 'yearly'
  interval INTEGER DEFAULT 1,  -- every N days/weeks/months/years
  days_of_week INTEGER[],      -- [0-6] for weekly (0=Sunday)
  day_of_month INTEGER,        -- 1-31 for monthly
  month_of_year INTEGER,       -- 1-12 for yearly

  -- For completion-based (schedule_type = 'completion')
  days_after_completion INTEGER
);
```

**Examples**:

- Every Monday: `frequency='weekly', days_of_week=[1]`
- Every 2 weeks on Mon/Wed/Fri:
  `frequency='weekly', interval=2, days_of_week=[1,3,5]`
- 1st of each month: `frequency='monthly', day_of_month=1`
- 14 days after completion:
  `schedule_type='completion', days_after_completion=14`

**Month length handling**: When `day_of_month` exceeds the number of days in the
target month, use the last day of that month. For example, a task on the 30th
will appear on February 28th (or 29th in leap years).

**Alternatives**:

- Cron expressions: Powerful but unfriendly, hard to edit, easy to get wrong
- Natural language: Requires complex parsing

### Decision: Projects with Inbox

**Choice**: Tasks can belong to a project. Tasks without a project appear in
"Inbox" - a virtual project for unorganized tasks.

**Schema**:

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id);
```

**Inbox behavior**: The Inbox is not stored as a project - it's a view showing
tasks where `project_id IS NULL`.

**Alternatives**:

- Require project for all tasks: Adds friction
- Tags instead of projects: Less hierarchical, harder to organize

### Decision: Task history/activity log

**Choice**: Store activity log in a separate table tracking task events.

**Schema**:

```sql
CREATE TABLE task_history (
  id UUID PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  action TEXT NOT NULL,      -- 'created', 'completed', 'deferred', 'edited', 'deleted'
  details JSONB,             -- action-specific data (old value, new value, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Alternatives**:

- Event sourcing: Overkill for personal app
- No history: Lose valuable pattern insights

### Decision: Basic markdown in task text

**Choice**: Support limited inline markdown in task titles and descriptions.

**Supported formatting**:

- Links: `[text](url)` - renders as clickable link
- Bold: `**text**`
- Italic: `*text*`
- Inline code: `` `code` ``

**Not supported**: Block elements (headers, lists, code blocks, blockquotes).
Titles remain primarily single-line text.

**Implementation**: Use a lightweight markdown parser (e.g., `marked` with
restricted options) on the frontend. Store raw markdown in database. Users type
raw markdown - no WYSIWYG editor or formatting toolbar.

**Alternatives**:

- Plain text only: Too limiting for links
- Full markdown: Overkill for task titles, invites complexity
- WYSIWYG editor: Adds significant complexity, overkill for simple formatting

### Decision: Project structure follows email-unsubscribe pattern

**Choice**: Mirror the established `api/` + `src/` structure with Hono routes,
Vue frontend, and Atlas schema migrations.

```text
todos/
├── api/
│   ├── main.ts
│   ├── app.ts
│   ├── routes/
│   │   ├── tasks.ts
│   │   ├── projects.ts
│   │   ├── contexts.ts
│   │   ├── filters.ts
│   │   ├── history.ts
│   │   └── next.ts
│   └── db/
├── src/           # Vue frontend
├── db/
│   └── schema.hcl
├── tests/
│   ├── unit/
│   └── e2e/
└── openspec/
```

### Decision: Supabase Realtime for live updates

**Choice**: Use Supabase Realtime subscriptions for live data updates instead of
polling or optimistic updates.

**Rationale**: Single-user app means no conflict concerns. Supabase Realtime
provides automatic reconnection and efficient change detection. Simpler than
implementing optimistic updates with rollback logic.

**Implementation**: Subscribe to relevant tables (tasks, projects, contexts) on
page load. Updates flow through subscriptions, triggering Vue reactivity.

**Alternatives**:

- Polling: Wasteful, adds latency
- Optimistic updates: Complex rollback logic for errors, not needed for single
  user
- WebSocket from scratch: Supabase already provides this

## Risks / Trade-offs

**Risk**: Context detection wrong for user's schedule

- Mitigation: Fully user-configurable contexts, can delete defaults

**Risk**: "Next" algorithm feels random or unhelpful

- Mitigation: Transparent scoring, allow manual override via task list view

**Risk**: Recurring tasks pile up if not completed

- Mitigation: Only one active instance per recurrence rule; completing creates
  next instance

**Risk**: Deferred tasks in wrong context frustrate user

- Mitigation: Manual context override button, clear UI showing task's contexts

**Risk**: Supabase Realtime connection drops

- Mitigation: Supabase client handles reconnection automatically; UI shows
  connection status if disconnected

## Open Questions

None - all questions resolved in design decisions above.
