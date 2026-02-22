// API client for backend communication

const API_BASE = "/api";

// Types matching backend schemas

export interface Task {
  id: string;
  title: string;
  description: string | null;
  project_id: string | null;
  priority: number;
  due_date: string | null;
  due_date_original: string | null;
  deferred_until: string | null;
  must_do: boolean;
  completed_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  context_ids?: string[];
}

export interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  task_count?: number;
}

export interface Context {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  time_windows?: TimeWindow[];
}

export interface TimeWindow {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export interface RecurrenceRule {
  id: string;
  task_id: string;
  schedule_type: "fixed" | "completion";
  frequency: "daily" | "weekly" | "monthly" | "yearly";
  interval: number;
  day_of_week: number | null;
  day_of_month: number | null;
  month_of_year: number | null;
  created_at: string;
}

export interface SavedFilter {
  id: string;
  user_id: string;
  name: string;
  criteria: FilterCriteria;
  created_at: string;
}

export interface FilterCriteria {
  contexts?: string[];
  projects?: string[];
  tags?: string[];
  dueBefore?: string;
  dueAfter?: string;
  completed?: boolean;
  hasRecurrence?: boolean;
}

export interface HistoryEntry {
  id: string;
  task_id: string;
  task_title?: string;
  action: string;
  changes: Record<string, unknown> | null;
  created_at: string;
}

export interface NextTaskResult {
  currentContextId?: string;
  tasks: ScoredTask[];
  totalEligible: number;
}

export interface ScoredTask extends Task {
  score: number;
  scoreBreakdown: {
    dueUrgency: number;
    age: number;
    contextMatch: number;
    projectMatch: number;
    random: number;
  };
}

// API error handling

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: "Unknown error" }));
    throw new ApiError(
      response.status,
      error.error || "Request failed",
      error.details,
    );
  }
  return response.json();
}

// Task API

export const tasks = {
  async list(params?: {
    projectId?: string;
    contextId?: string;
    completed?: boolean;
    deleted?: boolean;
    dueBefore?: string;
    dueAfter?: string;
    limit?: number;
    offset?: number;
  }): Promise<Task[]> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const response = await fetch(
      `${API_BASE}/tasks${query ? `?${query}` : ""}`,
    );
    return handleResponse<Task[]>(response);
  },

  async get(id: string): Promise<Task> {
    const response = await fetch(`${API_BASE}/tasks/${id}`);
    return handleResponse<Task>(response);
  },

  async create(data: {
    title: string;
    description?: string;
    projectId?: string;
    priority?: number;
    dueDate?: string;
    mustDo?: boolean;
    contextIds?: string[];
  }): Promise<Task> {
    const response = await fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<Task>(response);
  },

  async update(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      projectId?: string | null;
      priority?: number;
      dueDate?: string | null;
      mustDo?: boolean;
      contextIds?: string[];
    },
  ): Promise<Task> {
    const response = await fetch(`${API_BASE}/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<Task>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/tasks/${id}`, {
      method: "DELETE",
    });
    await handleResponse(response);
  },

  async complete(id: string): Promise<Task> {
    const response = await fetch(`${API_BASE}/tasks/${id}/complete`, {
      method: "POST",
    });
    return handleResponse<Task>(response);
  },

  async incomplete(id: string): Promise<Task> {
    const response = await fetch(`${API_BASE}/tasks/${id}/complete`, {
      method: "DELETE",
    });
    return handleResponse<Task>(response);
  },

  async defer(id: string, preset: string): Promise<Task> {
    const response = await fetch(`${API_BASE}/tasks/${id}/defer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preset }),
    });
    return handleResponse<Task>(response);
  },

  async undefer(id: string): Promise<Task> {
    const response = await fetch(`${API_BASE}/tasks/${id}/defer`, {
      method: "DELETE",
    });
    return handleResponse<Task>(response);
  },
};

// Project API

export const projects = {
  async list(): Promise<Project[]> {
    const response = await fetch(`${API_BASE}/projects`);
    return handleResponse<Project[]>(response);
  },

  async get(id: string): Promise<Project> {
    const response = await fetch(`${API_BASE}/projects/${id}`);
    return handleResponse<Project>(response);
  },

  async create(data: { name: string; description?: string }): Promise<Project> {
    const response = await fetch(`${API_BASE}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<Project>(response);
  },

  async update(
    id: string,
    data: { name?: string; description?: string | null },
  ): Promise<Project> {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<Project>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/projects/${id}`, {
      method: "DELETE",
    });
    await handleResponse(response);
  },

  async getInbox(): Promise<{ tasks: Task[] }> {
    const response = await fetch(`${API_BASE}/projects/inbox`);
    return handleResponse(response);
  },
};

// Context API

export const contexts = {
  async list(): Promise<Context[]> {
    const response = await fetch(`${API_BASE}/contexts`);
    return handleResponse<Context[]>(response);
  },

  async get(id: string): Promise<Context> {
    const response = await fetch(`${API_BASE}/contexts/${id}`);
    return handleResponse<Context>(response);
  },

  async getCurrent(): Promise<Context[]> {
    const response = await fetch(`${API_BASE}/contexts/current`);
    return handleResponse<Context[]>(response);
  },

  async create(data: {
    name: string;
    description?: string;
    timeWindows?: TimeWindow[];
  }): Promise<Context> {
    const response = await fetch(`${API_BASE}/contexts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<Context>(response);
  },

  async update(
    id: string,
    data: { name?: string; timeWindows?: TimeWindow[] },
  ): Promise<Context> {
    const response = await fetch(`${API_BASE}/contexts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<Context>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/contexts/${id}`, {
      method: "DELETE",
    });
    await handleResponse(response);
  },
};

// Recurrence API

export const recurrence = {
  async get(taskId: string): Promise<RecurrenceRule | null> {
    const response = await fetch(`${API_BASE}/recurrence/${taskId}`);
    if (response.status === 404) return null;
    return handleResponse<RecurrenceRule>(response);
  },

  async create(data: {
    taskId: string;
    scheduleType: "fixed" | "completion";
    frequency: "daily" | "weekly" | "monthly" | "yearly";
    interval?: number;
    dayOfWeek?: number;
    dayOfMonth?: number;
    monthOfYear?: number;
  }): Promise<RecurrenceRule> {
    const response = await fetch(`${API_BASE}/recurrence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<RecurrenceRule>(response);
  },

  async update(
    taskId: string,
    data: {
      scheduleType?: "fixed" | "completion";
      frequency?: "daily" | "weekly" | "monthly" | "yearly";
      interval?: number;
      dayOfWeek?: number | null;
      dayOfMonth?: number | null;
      monthOfYear?: number | null;
    },
  ): Promise<RecurrenceRule> {
    const response = await fetch(`${API_BASE}/recurrence/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<RecurrenceRule>(response);
  },

  async delete(taskId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/recurrence/${taskId}`, {
      method: "DELETE",
    });
    await handleResponse(response);
  },

  async complete(
    taskId: string,
  ): Promise<{ completedTask: Task; nextTask: Task }> {
    const response = await fetch(`${API_BASE}/recurrence/${taskId}/complete`, {
      method: "POST",
    });
    return handleResponse(response);
  },
};

// Filter API

export const filters = {
  async list(): Promise<SavedFilter[]> {
    const response = await fetch(`${API_BASE}/filters`);
    return handleResponse<SavedFilter[]>(response);
  },

  async get(id: string): Promise<SavedFilter> {
    const response = await fetch(`${API_BASE}/filters/${id}`);
    return handleResponse<SavedFilter>(response);
  },

  async create(data: {
    name: string;
    criteria: FilterCriteria;
  }): Promise<SavedFilter> {
    const response = await fetch(`${API_BASE}/filters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<SavedFilter>(response);
  },

  async update(
    id: string,
    data: { name?: string; criteria?: FilterCriteria },
  ): Promise<SavedFilter> {
    const response = await fetch(`${API_BASE}/filters/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse<SavedFilter>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/filters/${id}`, {
      method: "DELETE",
    });
    await handleResponse(response);
  },

  async apply(id: string): Promise<{ filter: SavedFilter; tasks: Task[] }> {
    const response = await fetch(`${API_BASE}/filters/${id}/apply`, {
      method: "POST",
    });
    return handleResponse(response);
  },
};

// History API

export const history = {
  async list(params?: {
    taskId?: string;
    action?: string;
    limit?: number;
    offset?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    entries: HistoryEntry[];
    pagination: {
      total: number;
      limit: number;
      offset: number;
      hasMore: boolean;
    };
  }> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const response = await fetch(
      `${API_BASE}/history${query ? `?${query}` : ""}`,
    );
    return handleResponse(response);
  },

  async getForTask(taskId: string): Promise<{ entries: HistoryEntry[] }> {
    const response = await fetch(`${API_BASE}/history/task/${taskId}`);
    return handleResponse(response);
  },

  async getStats(days?: number): Promise<{
    period: { days: number; since: string };
    actionCounts: { action: string; count: number }[];
    dailyActivity: { date: string; count: number }[];
    tasksCompleted: number;
  }> {
    const query = days ? `?days=${days}` : "";
    const response = await fetch(`${API_BASE}/history/stats${query}`);
    return handleResponse(response);
  },
};

// Next API

export const next = {
  async get(params?: {
    contextId?: string;
    projectId?: string;
    count?: number;
  }): Promise<NextTaskResult> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const response = await fetch(`${API_BASE}/next${query ? `?${query}` : ""}`);
    return handleResponse<NextTaskResult>(response);
  },

  async getRandom(params?: {
    contextId?: string;
    projectId?: string;
  }): Promise<{ task: ScoredTask | null }> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const response = await fetch(
      `${API_BASE}/next/random${query ? `?${query}` : ""}`,
    );
    return handleResponse(response);
  },
};

// Export/Import API

export const dataExport = {
  async exportAll(params?: {
    format?: "json" | "csv";
    includeCompleted?: boolean;
    includeDeleted?: boolean;
    projectId?: string;
    contextId?: string;
  }): Promise<Blob> {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          searchParams.set(key, String(value));
        }
      });
    }
    const query = searchParams.toString();
    const response = await fetch(
      `${API_BASE}/export${query ? `?${query}` : ""}`,
    );
    if (!response.ok) {
      const error = await response
        .json()
        .catch(() => ({ error: "Export failed" }));
      throw new ApiError(response.status, error.error);
    }
    return response.blob();
  },

  async exportTasks(format?: "json" | "csv"): Promise<Blob> {
    const query = format ? `?format=${format}` : "";
    const response = await fetch(`${API_BASE}/export/tasks${query}`);
    if (!response.ok) {
      throw new ApiError(response.status, "Export failed");
    }
    return response.blob();
  },
};

export const dataImport = {
  async importAll(
    data: unknown,
    options?: { mode?: "merge" | "replace"; skipDuplicates?: boolean },
  ): Promise<{
    success: boolean;
    imported: { projects: number; contexts: number; tasks: number };
    skipped: { projects: number; contexts: number; tasks: number };
    errors: string[];
  }> {
    const searchParams = new URLSearchParams();
    if (options?.mode) searchParams.set("mode", options.mode);
    if (options?.skipDuplicates !== undefined) {
      searchParams.set("skipDuplicates", String(options.skipDuplicates));
    }
    const query = searchParams.toString();
    const response = await fetch(
      `${API_BASE}/import${query ? `?${query}` : ""}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    return handleResponse(response);
  },

  async importTasks(
    tasks: { title: string; description?: string; due_date?: string }[],
  ): Promise<{
    success: boolean;
    imported: number;
    failed: number;
    errors: string[];
  }> {
    const response = await fetch(`${API_BASE}/import/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tasks }),
    });
    return handleResponse(response);
  },
};

// Combined API object for convenient imports
export const api = {
  tasks,
  projects,
  contexts,
  recurrence,
  filters,
  history,
  next,
  dataExport,
  dataImport,
};
