# Todos

Personal todo application with intelligent task presentation and flexible
recurrence. Built for single-user productivity with a focus on getting the right
task done at the right time.

**Live at [todos.mklv.tech](https://todos.mklv.tech)**

## Features

- **Next Page** - Smart task selection showing 2 relevant tasks based on
  priority, due date, and current context
- **Contexts** - User-defined time windows (e.g., work hours Mon-Fri 9-5) to
  filter tasks by availability
- **Flexible Recurrence** - Fixed schedules (daily, weekly, monthly) or
  completion-based ("14 days after done")
- **Projects & Inbox** - Organize tasks into projects or keep them in Inbox
- **Task History** - Activity log tracking completions, deferrals, and changes
- **Keyboard Shortcuts** - Fast, keyboard-driven workflow
- **Import/Export** - Full data ownership with JSON export

## Tech Stack

- **Runtime**: [Deno](https://deno.land/) 2.0+
- **Web Framework**: [Hono](https://hono.dev/)
- **Frontend**: Vue.js 3 + Tailwind CSS
- **Database**: PostgreSQL (via Supabase)
- **Real-time**: Supabase Realtime for live updates

## Quick Start

```bash
# Start API server with hot reload
deno task api:dev

# Start frontend dev server (in separate terminal)
deno task src:dev
```

## Documentation

- [Local Development](docs/development.md) - Development setup and debugging
- [Deployment Guide](docs/deployment.md) - Cloud Run deployment and monitoring
- [Architecture Overview](docs/architecture.md) - System design and data flow

## Authentication

Uses centralized login at [login.mklv.tech](https://login.mklv.tech) for
authentication. Single-user app with session validation via shared JWT key.
