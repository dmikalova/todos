-- Initialize database for local development
-- Creates the todos schema that Atlas will manage
-- Creates a non-superuser app role for RLS enforcement

CREATE SCHEMA IF NOT EXISTS todos;

-- App role: non-superuser so RLS policies are enforced
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'todos_app') THEN
    CREATE ROLE todos_app LOGIN PASSWORD 'todos_app';
  END IF;
END $$;

-- Grant schema and table access to the app role
GRANT USAGE ON SCHEMA todos TO todos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA todos GRANT ALL ON TABLES TO todos_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA todos GRANT ALL ON SEQUENCES TO todos_app;
