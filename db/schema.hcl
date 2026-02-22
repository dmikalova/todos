# Database schema for todos
# Managed by Atlas CLI - https://atlasgo.io

schema "todos" {}

# Enums

enum "schedule_type" {
  schema = schema.todos

  values = ["fixed", "completion"]
}

enum "frequency" {
  schema = schema.todos

  values = ["daily", "weekly", "monthly", "yearly"]
}

enum "task_action" {
  schema = schema.todos

  values = [
    "created",
    "updated",
    "completed",
    "uncompleted",
    "deferred",
    "undeferred",
    "deleted"
  ]
}

# Tables

table "projects" {
  schema = schema.todos

  column "id" {
    type    = uuid
    null    = false
    default = sql("gen_random_uuid()")
  }

  column "name" {
    type = text
    null = false
  }

  column "description" {
    type = text
    null = true
  }

  column "created_at" {
    type    = timestamptz
    null    = false
    default = sql("now()")
  }

  primary_key {
    columns = [column.id]
  }
}

table "contexts" {
  schema = schema.todos

  column "id" {
    type    = uuid
    null    = false
    default = sql("gen_random_uuid()")
  }

  column "name" {
    type = text
    null = false
  }

  column "created_at" {
    type    = timestamptz
    null    = false
    default = sql("now()")
  }

  primary_key {
    columns = [column.id]
  }
}

table "context_time_windows" {
  schema = schema.todos

  column "id" {
    type    = uuid
    null    = false
    default = sql("gen_random_uuid()")
  }

  column "context_id" {
    type = uuid
    null = false
  }

  # 0=Sunday, 6=Saturday
  column "day_of_week" {
    type = integer
    null = false
  }

  column "start_time" {
    type = time
    null = false
  }

  column "end_time" {
    type = time
    null = false
  }

  primary_key {
    columns = [column.id]
  }

  foreign_key "fk_context" {
    columns     = [column.context_id]
    ref_columns = [table.contexts.column.id]
    on_delete   = CASCADE
  }

  index "idx_context_time_windows_context_id" {
    columns = [column.context_id]
  }

  check "valid_day_of_week" {
    expr = "day_of_week >= 0 AND day_of_week <= 6"
  }

  check "valid_time_range" {
    expr = "start_time < end_time"
  }
}

table "tasks" {
  schema = schema.todos

  column "id" {
    type    = uuid
    null    = false
    default = sql("gen_random_uuid()")
  }

  column "title" {
    type = text
    null = false
  }

  column "description" {
    type = text
    null = true
  }

  column "project_id" {
    type = uuid
    null = true
  }

  # 1-4 priority, higher = more important
  column "priority" {
    type    = integer
    null    = false
    default = 2
  }

  column "due_date" {
    type = date
    null = true
  }

  # Cannot be deferred, always shows in Next
  column "must_do" {
    type    = boolean
    null    = false
    default = false
  }

  column "deferred_until" {
    type = timestamptz
    null = true
  }

  column "completed_at" {
    type = timestamptz
    null = true
  }

  # Soft delete flag
  column "deleted_at" {
    type = timestamptz
    null = true
  }

  column "created_at" {
    type    = timestamptz
    null    = false
    default = sql("now()")
  }

  column "updated_at" {
    type    = timestamptz
    null    = false
    default = sql("now()")
  }

  primary_key {
    columns = [column.id]
  }

  foreign_key "fk_project" {
    columns     = [column.project_id]
    ref_columns = [table.projects.column.id]
    on_delete   = SET_NULL
  }

  index "idx_tasks_project_id" {
    columns = [column.project_id]
  }

  index "idx_tasks_due_date" {
    columns = [column.due_date]
  }

  index "idx_tasks_completed_at" {
    columns = [column.completed_at]
  }

  index "idx_tasks_deleted_at" {
    columns = [column.deleted_at]
  }

  check "valid_priority" {
    expr = "priority >= 1 AND priority <= 4"
  }
}

table "task_contexts" {
  schema = schema.todos

  column "task_id" {
    type = uuid
    null = false
  }

  column "context_id" {
    type = uuid
    null = false
  }

  primary_key {
    columns = [column.task_id, column.context_id]
  }

  foreign_key "fk_task" {
    columns     = [column.task_id]
    ref_columns = [table.tasks.column.id]
    on_delete   = CASCADE
  }

  foreign_key "fk_context" {
    columns     = [column.context_id]
    ref_columns = [table.contexts.column.id]
    on_delete   = CASCADE
  }

  index "idx_task_contexts_context_id" {
    columns = [column.context_id]
  }
}

table "recurrence_rules" {
  schema = schema.todos

  column "id" {
    type    = uuid
    null    = false
    default = sql("gen_random_uuid()")
  }

  column "task_id" {
    type = uuid
    null = false
  }

  # 'fixed' or 'completion'
  column "schedule_type" {
    type = enum.schedule_type
    null = false
  }

  # For fixed schedules: 'daily', 'weekly', 'monthly', 'yearly'
  column "frequency" {
    type = enum.frequency
    null = true
  }

  # Every N days/weeks/months/years
  column "interval" {
    type    = integer
    null    = false
    default = 1
  }

  # [0-6] for weekly (0=Sunday)
  column "days_of_week" {
    type = sql("integer[]")
    null = true
  }

  # 1-31 for monthly
  column "day_of_month" {
    type = integer
    null = true
  }

  # 1-12 for yearly
  column "month_of_year" {
    type = integer
    null = true
  }

  # For completion-based schedules
  column "days_after_completion" {
    type = integer
    null = true
  }

  column "created_at" {
    type    = timestamptz
    null    = false
    default = sql("now()")
  }

  primary_key {
    columns = [column.id]
  }

  foreign_key "fk_task" {
    columns     = [column.task_id]
    ref_columns = [table.tasks.column.id]
    on_delete   = CASCADE
  }

  index "idx_recurrence_rules_task_id" {
    columns = [column.task_id]
  }

  # Ensure only one rule per task
  index "idx_recurrence_rules_task_unique" {
    columns = [column.task_id]
    unique  = true
  }

  check "valid_interval" {
    expr = "interval >= 1"
  }

  check "valid_day_of_month" {
    expr = "day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)"
  }

  check "valid_month_of_year" {
    expr = "month_of_year IS NULL OR (month_of_year >= 1 AND month_of_year <= 12)"
  }

  check "valid_days_after_completion" {
    expr = "days_after_completion IS NULL OR days_after_completion >= 1"
  }

  # Fixed schedules require frequency
  check "fixed_requires_frequency" {
    expr = "schedule_type::text != 'fixed' OR frequency IS NOT NULL"
  }

  # Completion-based schedules require days_after_completion
  check "completion_requires_days" {
    expr = "schedule_type::text != 'completion' OR days_after_completion IS NOT NULL"
  }
}

table "saved_filters" {
  schema = schema.todos

  column "id" {
    type    = uuid
    null    = false
    default = sql("gen_random_uuid()")
  }

  column "name" {
    type = text
    null = false
  }

  # JSON filter definition
  column "filter" {
    type = jsonb
    null = false
  }

  column "created_at" {
    type    = timestamptz
    null    = false
    default = sql("now()")
  }

  primary_key {
    columns = [column.id]
  }
}

table "task_history" {
  schema = schema.todos

  column "id" {
    type    = uuid
    null    = false
    default = sql("gen_random_uuid()")
  }

  column "task_id" {
    type = uuid
    null = false
  }

  column "action" {
    type = enum.task_action
    null = false
  }

  # Action-specific data (old value, new value, etc.)
  column "details" {
    type = jsonb
    null = true
  }

  column "created_at" {
    type    = timestamptz
    null    = false
    default = sql("now()")
  }

  primary_key {
    columns = [column.id]
  }

  foreign_key "fk_task" {
    columns     = [column.task_id]
    ref_columns = [table.tasks.column.id]
    on_delete   = CASCADE
  }

  index "idx_task_history_task_id" {
    columns = [column.task_id]
  }

  index "idx_task_history_created_at" {
    columns = [column.created_at]
  }
}
