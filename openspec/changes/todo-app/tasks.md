# Todo App: Tasks

## 1. Project Setup

- [ ] 1.1 Initialize repository with README, LICENSE, .gitignore
- [ ] 1.2 Create deno.jsonc with tasks, imports, and permission sets
- [ ] 1.3 Set up project structure (api/, src/, db/, scripts/, tests/)
- [ ] 1.4 Configure lefthook.jsonc and commitlint.config.mjs
- [ ] 1.5 Add quickmark.toml for bookmarks

## 2. Database Schema

- [ ] 2.1 Create db/schema.hcl with tasks table
- [ ] 2.2 Add projects table schema
- [ ] 2.3 Add contexts table schema (user-defined contexts)
- [ ] 2.4 Add context_time_windows table schema (per-day time windows)
- [ ] 2.5 Add task_contexts join table schema (many-to-many)
- [ ] 2.6 Add recurrence_rules table with friendly fields (frequency, interval,
      days_of_week, day_of_month, month_of_year, days_after_completion)
- [ ] 2.7 Add saved_filters table schema
- [ ] 2.8 Add task_history table schema
- [ ] 2.9 Create initial migration with seed data for default context (work
      Mon-Fri 9-5)

## 3. API Foundation

- [ ] 3.1 Create api/main.ts entry point with Hono app
- [ ] 3.2 Add api/config.ts for environment variables
- [ ] 3.3 Set up api/db/client.ts for PostgreSQL connection pool
- [ ] 3.4 Add auth middleware validating session from login portal
- [ ] 3.5 Add error handling middleware with JSON responses

## 4. Task Management API

- [ ] 4.1 Create api/routes/tasks.ts with CRUD endpoints
- [ ] 4.2 Add Zod schemas for task validation (including context_ids array)
- [ ] 4.3 Implement POST /api/tasks (create task with multi-context support)
- [ ] 4.4 Implement GET /api/tasks (list tasks with filters)
- [ ] 4.5 Implement GET /api/tasks/:id (get single task with contexts)
- [ ] 4.6 Implement PATCH /api/tasks/:id (update task, including contexts)
- [ ] 4.7 Implement DELETE /api/tasks/:id (soft delete, log to history)
- [ ] 4.8 Implement POST /api/tasks/:id/complete (complete task, log to history)
- [ ] 4.9 Implement DELETE /api/tasks/:id/complete (undo complete, log to
      history)
- [ ] 4.10 Add task_contexts insert/update/delete on task mutations

## 5. Recurrence System API

- [ ] 5.1 Create api/services/recurrence.ts with calculation logic
- [ ] 5.2 Implement recurrence rule creation with friendly fields
- [ ] 5.3 Implement next occurrence for fixed schedules: - daily: add interval
      days - weekly: find next matching weekday - monthly: find next month with
      day_of_month (clamp to month length) - yearly: find next year with
      month_of_year and day_of_month
- [ ] 5.4 Implement next occurrence for completion-based (add
      days_after_completion)
- [ ] 5.5 Add logic to create next task instance on completion
- [ ] 5.6 Implement DELETE recurrence (convert to one-time task)

## 6. Contexts API

- [ ] 6.1 Create api/routes/contexts.ts with CRUD endpoints
- [ ] 6.2 Implement POST /api/contexts (create context with time windows per
      day)
- [ ] 6.3 Implement GET /api/contexts (list all contexts with time windows)
- [ ] 6.4 Implement PATCH /api/contexts/:id (update context name and time
      windows)
- [ ] 6.5 Implement DELETE /api/contexts/:id (delete context, remove from tasks)
- [ ] 6.6 Implement GET /api/contexts/current (accepts client local time,
      returns active contexts)
- [ ] 6.7 Add context matching logic (check day_of_week + time window)

## 7. Projects API

- [ ] 7.1 Create api/routes/projects.ts with CRUD endpoints
- [ ] 7.2 Implement POST /api/projects (create project)
- [ ] 7.3 Implement GET /api/projects (list projects)
- [ ] 7.4 Implement GET /api/projects/inbox (virtual Inbox - tasks with no
      project)
- [ ] 7.5 Implement PATCH /api/projects/:id (update project)
- [ ] 7.6 Implement DELETE /api/projects/:id (delete, move tasks to Inbox)

## 8. Filters API

- [ ] 8.1 Create api/routes/filters.ts with CRUD endpoints
- [ ] 8.2 Implement POST /api/filters (create saved filter)
- [ ] 8.3 Implement GET /api/filters (list saved filters)
- [ ] 8.4 Implement PATCH /api/filters/:id (update filter)
- [ ] 8.5 Implement DELETE /api/filters/:id (delete filter)
- [ ] 8.6 Implement filter application in GET /api/tasks (query param parsing)

## 9. History API

- [ ] 9.1 Create api/routes/history.ts endpoint
- [ ] 9.2 Implement GET /api/history (paginated, all task events)
- [ ] 9.3 Implement GET /api/tasks/:id/history (events for single task)
- [ ] 9.4 Add history logging service for task events (create, update, complete,
      delete, defer)

## 10. Import/Export API

- [ ] 10.1 Create api/routes/export.ts endpoint
- [ ] 10.2 Implement GET /api/export (JSON download of all data)
- [ ] 10.3 Create api/routes/import.ts endpoint
- [ ] 10.4 Add Zod schema for import validation
- [ ] 10.5 Implement POST /api/import with conflict handling (skip, overwrite,
      merge)

## 11. Next Page API

- [ ] 11.1 Create api/routes/next.ts endpoint
- [ ] 11.2 Implement task scoring algorithm (priority + overdue + must_do)
- [ ] 11.3 Implement weighted randomness within score tiers (±5 points)
- [ ] 11.4 Implement eligible task filtering: - Not deferred OR defer time
      passed AND matching context - Not completed - Due date <= today (or no due
      date) - Context matches current OR task has no contexts OR manual override
- [ ] 11.5 Implement GET /api/next (accepts local time + optional context
      override, returns 2 random top-scored tasks)
- [ ] 11.6 Implement POST /api/tasks/:id/defer (log to history)
- [ ] 11.7 Implement DELETE /api/tasks/:id/defer (clear defer, log to history)

## 12. Frontend Setup

- [ ] 12.1 Create src/deno.jsonc for frontend dev server
- [ ] 12.2 Set up Vite configuration for Vue + TypeScript
- [ ] 12.3 Configure Tailwind CSS with Material Design colors
- [ ] 12.4 Create src/App.vue with router setup
- [ ] 12.5 Add src/api.ts client for backend communication
- [ ] 12.6 Add src/composables/useKeyboardShortcuts.ts
- [ ] 12.7 Add src/utils/markdown.ts for basic markdown rendering (links, bold,
      italic, inline code)
- [ ] 12.8 Add src/composables/useSupabaseRealtime.ts for live subscriptions

## 13. Frontend Views

- [ ] 13.1 Create src/views/NextView.vue (Next page with 2 tasks)
- [ ] 13.2 Create src/views/TasksView.vue (task list with filters)
- [ ] 13.3 Create src/views/ProjectsView.vue (project management)
- [ ] 13.4 Create src/views/HistoryView.vue (activity log)
- [ ] 13.5 Create src/views/SettingsView.vue (contexts, import/export)
- [ ] 13.6 Add navigation component with responsive layout

## 14. Frontend Components

- [ ] 14.1 Create TaskCard.vue component (display task with markdown rendering)
- [ ] 14.2 Create TaskForm.vue component (create/edit task dialog with
      multi-context select)
- [ ] 14.3 Create DeferMenu.vue component (defer options dropdown)
- [ ] 14.4 Create ProjectSelect.vue component (project picker)
- [ ] 14.5 Create ContextSelect.vue component (multi-select context picker)
- [ ] 14.6 Create RecurrenceForm.vue component (friendly recurrence UI)
- [ ] 14.7 Create FilterBar.vue component (quick filters + saved filter select)
- [ ] 14.8 Create ErrorToast.vue component (top center toast notifications)
- [ ] 14.9 Create KeyboardShortcutsDialog.vue component (help dialog)
- [ ] 14.10 Create ContextSelector.vue component (header context override)
- [ ] 14.11 Create ImportExport.vue component (settings import/export UI)

## 15. Unit Tests

- [ ] 15.1 Set up Vitest configuration in tests/
- [ ] 15.2 Test recurrence calculation logic (all schedule types, month length
      edge cases like 30th in February)
- [ ] 15.3 Test context matching logic (time windows, weekdays)
- [ ] 15.4 Test Next page scoring algorithm
- [ ] 15.5 Test filter query building
- [ ] 15.6 Test import validation
- [ ] 15.7 Test markdown parsing (links, bold, italic, code)

## 16. E2E Tests

- [ ] 16.1 Set up Playwright configuration
- [ ] 16.2 Test task CRUD flow (create, edit, complete, delete)
- [ ] 16.3 Test Next page navigation and defer
- [ ] 16.4 Test filter application
- [ ] 16.5 Test context management
- [ ] 16.6 Test import/export flow

## 17. Infrastructure

- [ ] 17.1 Create Dockerfile for Cloud Run deployment
- [ ] 17.2 Add todos app to infrastructure Terramate stack
- [ ] 17.3 Configure Supabase database and pooler connection
- [ ] 17.4 Set up GitHub Actions workflow using github-meta
- [ ] 17.5 Configure DNS for todos.mklv.tech subdomain
- [ ] 17.6 Add secrets to Secret Manager (database URL, etc.)

## 18. Integration Testing

- [ ] 18.1 Test auth flow with login.mklv.tech
- [ ] 18.2 Verify session validation middleware works correctly
- [ ] 18.3 Test recurrence completion flow end-to-end
- [ ] 18.4 Verify context detection with manual override
- [ ] 18.5 Test Next page with deferred tasks respecting context
- [ ] 18.6 Test keyboard shortcuts across all views
