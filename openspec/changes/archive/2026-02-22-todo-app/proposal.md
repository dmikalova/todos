# Todo App: Proposal

## Why

Existing todo apps lack intelligent task presentation that considers time
context, recurrence patterns, and priority together. I want a personal todo
system with a "Next" page that presents the right task at the right time,
reducing decision fatigue while ensuring important tasks don't slip.

## What Changes

- Create new todo application with:
  - Task management with CRUD operations
  - Flexible recurrence system (fixed schedules + completion-based)
  - User-defined contexts with per-day time windows (default: work Mon-Fri 9-5)
  - Priority levels for task ordering
  - Projects with Inbox for unassigned tasks
  - Saved filters for custom views
  - Task history/activity log
  - Import/export to JSON
  - Keyboard shortcuts for power users
  - **"Next" page** - unique feature presenting 2 task options based on current
    context, with defer/complete actions

## Capabilities

### New Capabilities

- `task-management`: Core task CRUD with title, description, due date, priority,
  project assignment. Tasks can have multiple contexts.

- `recurrence-system`: Two recurrence modes - fixed schedules using friendly UI
  (daily, weekly on days, monthly on date, yearly) and completion-based ("7 days
  after completing this task"). No cron expressions.

- `contexts`: User-defined contexts with configurable per-day time windows.
  Default: work (Mon-Fri 9-5). Users can create, edit, delete any context
  including defaults. Tasks can have multiple contexts and only appear when at
  least one of their contexts is active. Tasks without contexts are always
  eligible.

- `projects-filters`: Projects with special Inbox for tasks without a project.
  Saved filter views combining project, priority, contexts, due date range,
  completion status.

- `next-page`: Smart task selection presenting 2 options based on due date,
  context match, and priority with weighted randomness. Deferred tasks respect
  context - if deferred to a time outside current context, task won't appear
  until that context is active again. User can manually enter any context.

- `web-dashboard`: Vue.js frontend with task list views, project navigation,
  Inbox, and the "Next" page interface. Error toasts at top center. Keyboard
  shortcuts (e.g., 'a' to add task to current project).

- `history`: Activity log tracking task completions, deferrals, and edits.
  Useful for reviewing patterns.

- `import-export`: JSON export/import for backup and migration from other apps.

- `testing`: Unit tests with Vitest, E2E tests with Playwright.

### Modified Capabilities

None - this is a new application.

## Impact

- **New repository**: `todos` with full stack (API + frontend + database)
- **Infrastructure**: New Cloud Run service, database schema, DNS entry
- **Authentication**: Integration with login.mklv.tech portal
- **CI/CD**: Reusable workflow from github-meta
