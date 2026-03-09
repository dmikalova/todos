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
ALTER TABLE todos.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos.projects FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS projects_user_select ON todos.projects;
CREATE POLICY projects_user_select ON todos.projects FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS projects_user_insert ON todos.projects;
CREATE POLICY projects_user_insert ON todos.projects FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS projects_user_update ON todos.projects;
CREATE POLICY projects_user_update ON todos.projects FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS projects_user_delete ON todos.projects;
CREATE POLICY projects_user_delete ON todos.projects FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- contexts
-- ============================================================================
ALTER TABLE todos.contexts ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos.contexts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contexts_user_select ON todos.contexts;
CREATE POLICY contexts_user_select ON todos.contexts FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS contexts_user_insert ON todos.contexts;
CREATE POLICY contexts_user_insert ON todos.contexts FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS contexts_user_update ON todos.contexts;
CREATE POLICY contexts_user_update ON todos.contexts FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS contexts_user_delete ON todos.contexts;
CREATE POLICY contexts_user_delete ON todos.contexts FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- context_time_windows (no user_id — check via parent context)
-- ============================================================================
ALTER TABLE todos.context_time_windows ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos.context_time_windows FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ctw_user_select ON todos.context_time_windows;
CREATE POLICY ctw_user_select ON todos.context_time_windows FOR SELECT
  USING (EXISTS (SELECT 1 FROM todos.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS ctw_user_insert ON todos.context_time_windows;
CREATE POLICY ctw_user_insert ON todos.context_time_windows FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM todos.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS ctw_user_update ON todos.context_time_windows;
CREATE POLICY ctw_user_update ON todos.context_time_windows FOR UPDATE
  USING (EXISTS (SELECT 1 FROM todos.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM todos.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS ctw_user_delete ON todos.context_time_windows;
CREATE POLICY ctw_user_delete ON todos.context_time_windows FOR DELETE
  USING (EXISTS (SELECT 1 FROM todos.contexts WHERE id = context_id AND user_id = current_setting('app.user_id')::uuid));

-- ============================================================================
-- tasks
-- ============================================================================
ALTER TABLE todos.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos.tasks FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tasks_user_select ON todos.tasks;
CREATE POLICY tasks_user_select ON todos.tasks FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS tasks_user_insert ON todos.tasks;
CREATE POLICY tasks_user_insert ON todos.tasks FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS tasks_user_update ON todos.tasks;
CREATE POLICY tasks_user_update ON todos.tasks FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS tasks_user_delete ON todos.tasks;
CREATE POLICY tasks_user_delete ON todos.tasks FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- recurrence_rules (no user_id — check via parent task)
-- ============================================================================
ALTER TABLE todos.recurrence_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos.recurrence_rules FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS recurrence_user_select ON todos.recurrence_rules;
CREATE POLICY recurrence_user_select ON todos.recurrence_rules FOR SELECT
  USING (EXISTS (SELECT 1 FROM todos.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS recurrence_user_insert ON todos.recurrence_rules;
CREATE POLICY recurrence_user_insert ON todos.recurrence_rules FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM todos.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS recurrence_user_update ON todos.recurrence_rules;
CREATE POLICY recurrence_user_update ON todos.recurrence_rules FOR UPDATE
  USING (EXISTS (SELECT 1 FROM todos.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid))
  WITH CHECK (EXISTS (SELECT 1 FROM todos.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid));

DROP POLICY IF EXISTS recurrence_user_delete ON todos.recurrence_rules;
CREATE POLICY recurrence_user_delete ON todos.recurrence_rules FOR DELETE
  USING (EXISTS (SELECT 1 FROM todos.tasks WHERE id = task_id AND user_id = current_setting('app.user_id')::uuid));

-- ============================================================================
-- saved_filters
-- ============================================================================
ALTER TABLE todos.saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos.saved_filters FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS saved_filters_user_select ON todos.saved_filters;
CREATE POLICY saved_filters_user_select ON todos.saved_filters FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS saved_filters_user_insert ON todos.saved_filters;
CREATE POLICY saved_filters_user_insert ON todos.saved_filters FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS saved_filters_user_update ON todos.saved_filters;
CREATE POLICY saved_filters_user_update ON todos.saved_filters FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS saved_filters_user_delete ON todos.saved_filters;
CREATE POLICY saved_filters_user_delete ON todos.saved_filters FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- task_history
-- ============================================================================
ALTER TABLE todos.task_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos.task_history FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS task_history_user_select ON todos.task_history;
CREATE POLICY task_history_user_select ON todos.task_history FOR SELECT
  USING (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS task_history_user_insert ON todos.task_history;
CREATE POLICY task_history_user_insert ON todos.task_history FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS task_history_user_update ON todos.task_history;
CREATE POLICY task_history_user_update ON todos.task_history FOR UPDATE
  USING (user_id = current_setting('app.user_id')::uuid)
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

DROP POLICY IF EXISTS task_history_user_delete ON todos.task_history;
CREATE POLICY task_history_user_delete ON todos.task_history FOR DELETE
  USING (user_id = current_setting('app.user_id')::uuid);

-- ============================================================================
-- Grants for non-superuser app role (superusers bypass RLS)
-- ============================================================================
GRANT USAGE ON SCHEMA todos TO todos_app;
GRANT ALL ON ALL TABLES IN SCHEMA todos TO todos_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA todos TO todos_app;

COMMIT;
