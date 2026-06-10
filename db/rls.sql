-- Row Level Security policies for all tables
-- Applied after Atlas schema management (Atlas community edition does not manage RLS)
-- All policies restrict operations to rows where user_id matches the session user
-- Set app.user_id via: SET LOCAL app.user_id = '<uuid>'

-- Tables with user_id column: direct user_id check
-- Tables without user_id: subquery through parent FK

BEGIN;

-- ============================================================================
-- projects
-- ============================================================================
ALTER TABLE tasks.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_user_select ON tasks.projects;
CREATE POLICY projects_user_select ON tasks.projects FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS projects_user_insert ON tasks.projects;
CREATE POLICY projects_user_insert ON tasks.projects FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS projects_user_update ON tasks.projects;
CREATE POLICY projects_user_update ON tasks.projects FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS projects_user_delete ON tasks.projects;
CREATE POLICY projects_user_delete ON tasks.projects FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- contexts
-- ============================================================================
ALTER TABLE tasks.contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.contexts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contexts_user_select ON tasks.contexts;
CREATE POLICY contexts_user_select ON tasks.contexts FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS contexts_user_insert ON tasks.contexts;
CREATE POLICY contexts_user_insert ON tasks.contexts FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS contexts_user_update ON tasks.contexts;
CREATE POLICY contexts_user_update ON tasks.contexts FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS contexts_user_delete ON tasks.contexts;
CREATE POLICY contexts_user_delete ON tasks.contexts FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- context_time_windows (no user_id — check via parent context)
-- ============================================================================
ALTER TABLE tasks.context_time_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.context_time_windows FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ctw_user_select ON tasks.context_time_windows;
CREATE POLICY ctw_user_select ON tasks.context_time_windows FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS ctw_user_insert ON tasks.context_time_windows;
CREATE POLICY ctw_user_insert ON tasks.context_time_windows FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tasks.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS ctw_user_update ON tasks.context_time_windows;
CREATE POLICY ctw_user_update ON tasks.context_time_windows FOR UPDATE
  USING (EXISTS (SELECT 1 FROM tasks.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS ctw_user_delete ON tasks.context_time_windows;
CREATE POLICY ctw_user_delete ON tasks.context_time_windows FOR DELETE
  USING (EXISTS (SELECT 1 FROM tasks.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid));

-- ============================================================================
-- tasks
-- ============================================================================
ALTER TABLE tasks.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_user_select ON tasks.tasks;
CREATE POLICY tasks_user_select ON tasks.tasks FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS tasks_user_insert ON tasks.tasks;
CREATE POLICY tasks_user_insert ON tasks.tasks FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS tasks_user_update ON tasks.tasks;
CREATE POLICY tasks_user_update ON tasks.tasks FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS tasks_user_delete ON tasks.tasks;
CREATE POLICY tasks_user_delete ON tasks.tasks FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- recurrence_rules (no user_id — check via parent task)
-- ============================================================================
ALTER TABLE tasks.recurrence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.recurrence_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recurrence_user_select ON tasks.recurrence_rules;
CREATE POLICY recurrence_user_select ON tasks.recurrence_rules FOR SELECT
  USING (EXISTS (SELECT 1 FROM tasks.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS recurrence_user_insert ON tasks.recurrence_rules;
CREATE POLICY recurrence_user_insert ON tasks.recurrence_rules FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM tasks.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS recurrence_user_update ON tasks.recurrence_rules;
CREATE POLICY recurrence_user_update ON tasks.recurrence_rules FOR UPDATE
  USING (EXISTS (SELECT 1 FROM tasks.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM tasks.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS recurrence_user_delete ON tasks.recurrence_rules;
CREATE POLICY recurrence_user_delete ON tasks.recurrence_rules FOR DELETE
  USING (EXISTS (SELECT 1 FROM tasks.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid));

-- ============================================================================
-- saved_filters
-- ============================================================================
ALTER TABLE tasks.saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.saved_filters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_filters_user_select ON tasks.saved_filters;
CREATE POLICY saved_filters_user_select ON tasks.saved_filters FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS saved_filters_user_insert ON tasks.saved_filters;
CREATE POLICY saved_filters_user_insert ON tasks.saved_filters FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS saved_filters_user_update ON tasks.saved_filters;
CREATE POLICY saved_filters_user_update ON tasks.saved_filters FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS saved_filters_user_delete ON tasks.saved_filters;
CREATE POLICY saved_filters_user_delete ON tasks.saved_filters FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- task_history
-- ============================================================================
ALTER TABLE tasks.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.task_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_history_user_select ON tasks.task_history;
CREATE POLICY task_history_user_select ON tasks.task_history FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS task_history_user_insert ON tasks.task_history;
CREATE POLICY task_history_user_insert ON tasks.task_history FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS task_history_user_update ON tasks.task_history;
CREATE POLICY task_history_user_update ON tasks.task_history FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS task_history_user_delete ON tasks.task_history;
CREATE POLICY task_history_user_delete ON tasks.task_history FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- user_settings
-- ============================================================================
ALTER TABLE tasks.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks.user_settings FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_settings_user_select ON tasks.user_settings;
CREATE POLICY user_settings_user_select ON tasks.user_settings FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS user_settings_user_insert ON tasks.user_settings;
CREATE POLICY user_settings_user_insert ON tasks.user_settings FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS user_settings_user_update ON tasks.user_settings;
CREATE POLICY user_settings_user_update ON tasks.user_settings FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS user_settings_user_delete ON tasks.user_settings;
CREATE POLICY user_settings_user_delete ON tasks.user_settings FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- Grants for non-superuser app role (superusers bypass RLS)
-- ============================================================================
DO $$
BEGIN
  -- Grant to production role if it exists
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tasks-role') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA tasks TO "tasks-role"';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA tasks TO "tasks-role"';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA tasks TO "tasks-role"';
  END IF;
  -- Grant to local dev role if it exists
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tasks_app') THEN
    EXECUTE 'GRANT USAGE ON SCHEMA tasks TO tasks_app';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA tasks TO tasks_app';
    EXECUTE 'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA tasks TO tasks_app';
  END IF;
END $$;

COMMIT;
