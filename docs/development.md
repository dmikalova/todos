# Development

Local development setup for the todos app.

## Prerequisites

- [Deno](https://deno.land/) 2.0+
- PostgreSQL database (via Supabase or local)

## Setup

1. Clone the repository
2. Copy environment variables (see `.env.example` when created)
3. Run database migrations: `deno task db:apply`
4. Start the API server: `deno task api:dev`
5. Start the frontend: `deno task src:dev`

## Environment Variables

| Variable                   | Description               |
| -------------------------- | ------------------------- |
| `DATABASE_URL_TRANSACTION` | PostgreSQL connection URL |
| `SUPABASE_URL`             | Supabase project URL      |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key  |
| `SUPABASE_JWT_KEY`         | JWT secret for validation |

## Testing

```bash
# Run unit tests
deno task test

# Run all tests (requires database)
deno task test:all
```
