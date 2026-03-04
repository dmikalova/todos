// Reactive state store for the Todo app
// Uses a simple pub/sub pattern for Lit components

export interface Task {
  id: number;
  title: string;
  notes?: string;
  priority: number;
  status: string;
  due_date?: string;
  deferred_until?: string;
  project_id?: number;
  project_name?: string;
  context_id?: number;
  context_ids?: number[];
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_days?: number[];
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: number;
  name: string;
  color?: string;
  task_count?: number;
}

export interface Context {
  id: number;
  name: string;
  color?: string;
  time_windows?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
}

export interface HistoryEntry {
  id: number;
  task_id: number;
  task_title?: string;
  action: string;
  created_at: string;
}

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

type Listener = () => void;

class Store {
  // State
  private _tasks: Task[] = [];
  private _projects: Project[] = [];
  private _contexts: Context[] = [];
  private _history: HistoryEntry[] = [];
  private _currentTask: Task | null = null;
  private _loading = true;

  // UI State
  private _currentTab = "next";
  private _selectedProjectId: number | null = null;
  private _selectedContextId: number | null = null;
  private _sidebarOpen = false;
  private _showTaskForm = false;
  private _showProjectForm = false;
  private _showContextForm = false;
  private _showSearch = false;
  private _editingTask: Task | null = null;
  private _editingProject: Project | null = null;
  private _editingContext: Context | null = null;
  private _toasts: Toast[] = [];
  private _taskFilter = { completed: "false" };

  // Listeners for reactivity
  private listeners: Set<Listener> = new Set();

  // Getters
  get tasks() {
    return this._tasks;
  }
  get projects() {
    return this._projects;
  }
  get contexts() {
    return this._contexts;
  }
  get history() {
    return this._history;
  }
  get currentTask() {
    return this._currentTask;
  }
  get loading() {
    return this._loading;
  }
  get currentTab() {
    return this._currentTab;
  }
  get selectedProjectId() {
    return this._selectedProjectId;
  }
  get selectedContextId() {
    return this._selectedContextId;
  }
  get sidebarOpen() {
    return this._sidebarOpen;
  }
  get showTaskForm() {
    return this._showTaskForm;
  }
  get showProjectForm() {
    return this._showProjectForm;
  }
  get showContextForm() {
    return this._showContextForm;
  }
  get showSearch() {
    return this._showSearch;
  }
  get editingTask() {
    return this._editingTask;
  }
  get editingProject() {
    return this._editingProject;
  }
  get editingContext() {
    return this._editingContext;
  }
  get toasts() {
    return this._toasts;
  }
  get taskFilter() {
    return this._taskFilter;
  }

  // Computed values
  get inboxTasks(): Task[] {
    return this._tasks.filter((task) => {
      if (task.project_id) return false;
      if (this._taskFilter.completed === "true" && !task.completed_at) {
        return false;
      }
      if (this._taskFilter.completed === "false" && task.completed_at) {
        return false;
      }
      return true;
    });
  }

  get inboxCount(): number {
    return this._tasks.filter((t) => !t.project_id && !t.completed_at).length;
  }

  get dueTasks(): Task[] {
    return this._tasks
      .filter((t) => t.due_date && !t.completed_at)
      .sort(
        (a, b) =>
          new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime(),
      );
  }

  get dueCount(): number {
    return this.dueTasks.length;
  }

  get projectTasks(): Task[] {
    if (!this._selectedProjectId) return [];
    return this._tasks.filter(
      (t) =>
        t.project_id === this._selectedProjectId &&
        (this._taskFilter.completed === "true"
          ? t.completed_at
          : !t.completed_at),
    );
  }

  get contextTasks(): Task[] {
    if (!this._selectedContextId) return [];
    return this._tasks.filter(
      (t) =>
        t.context_id === this._selectedContextId &&
        (this._taskFilter.completed === "true"
          ? t.completed_at
          : !t.completed_at),
    );
  }

  get currentPageTitle(): string {
    switch (this._currentTab) {
      case "next":
        return "Next";
      case "inbox":
        return "Inbox";
      case "due":
        return "Due";
      case "history":
        return "History";
      case "settings":
        return "Settings";
      case "project": {
        const p = this._projects.find((p) => p.id === this._selectedProjectId);
        return p?.name || "Project";
      }
      case "context": {
        const c = this._contexts.find((c) => c.id === this._selectedContextId);
        return c?.name || "Context";
      }
      default:
        return "Todos";
    }
  }

  // Subscribe to changes
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // API helper
  private async api<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`/api${endpoint}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  // Toast notifications
  showToast(message: string, type: "success" | "error" = "success") {
    const id = Date.now();
    this._toasts = [...this._toasts, { id, message, type }];
    this.notify();
    setTimeout(() => {
      this._toasts = this._toasts.filter((t) => t.id !== id);
      this.notify();
    }, 3000);
  }

  // Navigation
  navigate(tab: string, id: number | null = null) {
    this._currentTab = tab;
    this._sidebarOpen = false;
    if (tab === "project") {
      this._selectedProjectId = id;
      history.pushState({}, "", `/projects/${id}`);
    } else if (tab === "context") {
      this._selectedContextId = id;
      history.pushState({}, "", `/contexts/${id}`);
    } else {
      history.pushState({}, "", `/${tab}`);
    }
    this.notify();
  }

  parseUrl() {
    const path = globalThis.location?.pathname || "/next";
    const match = path.match(/^\/(\w+)(?:\/(.+))?$/);
    if (match) {
      const [, tab, id] = match;
      if (tab === "projects" && id) {
        this._currentTab = "project";
        this._selectedProjectId = parseInt(id, 10);
      } else if (tab === "contexts" && id) {
        this._currentTab = "context";
        this._selectedContextId = parseInt(id, 10);
      } else if (
        ["inbox", "next", "due", "history", "settings"].includes(tab)
      ) {
        this._currentTab = tab;
      }
    }
    this.notify();
  }

  // UI state setters
  setSidebarOpen(open: boolean) {
    this._sidebarOpen = open;
    this.notify();
  }

  setShowTaskForm(show: boolean, task: Task | null = null) {
    this._showTaskForm = show;
    this._editingTask = task;
    this.notify();
  }

  setShowProjectForm(show: boolean, project: Project | null = null) {
    this._showProjectForm = show;
    this._editingProject = project;
    this.notify();
  }

  setShowContextForm(show: boolean, context: Context | null = null) {
    this._showContextForm = show;
    this._editingContext = context;
    this.notify();
  }

  setShowSearch(show: boolean) {
    this._showSearch = show;
    this.notify();
  }

  setTaskFilter(filter: { completed: string }) {
    this._taskFilter = filter;
    this.notify();
  }

  // Data fetching
  async fetchAll() {
    this._loading = true;
    this.notify();
    try {
      const [next, tasks, projects, contexts, history] = await Promise.all([
        this.api<Task | null>("/next"),
        this.api<Task[]>("/tasks"),
        this.api<Project[]>("/projects"),
        this.api<Context[]>("/contexts"),
        this.api<HistoryEntry[]>("/history"),
      ]);
      this._currentTask = next;
      this._tasks = tasks;
      this._projects = projects;
      this._contexts = contexts;
      this._history = history;
    } catch (_e) {
      this.showToast("Failed to load data", "error");
    } finally {
      this._loading = false;
      this.notify();
    }
  }

  async fetchNext() {
    try {
      this._currentTask = await this.api<Task | null>("/next");
      this.notify();
    } catch (_e) {
      this.showToast("Failed to load next task", "error");
    }
  }

  async fetchTasks() {
    try {
      this._tasks = await this.api<Task[]>("/tasks");
      this.notify();
    } catch (_e) {
      this.showToast("Failed to load tasks", "error");
    }
  }

  async fetchProjects() {
    try {
      this._projects = await this.api<Project[]>("/projects");
      this.notify();
    } catch (_e) {
      this.showToast("Failed to load projects", "error");
    }
  }

  async fetchContexts() {
    try {
      this._contexts = await this.api<Context[]>("/contexts");
      this.notify();
    } catch (_e) {
      this.showToast("Failed to load contexts", "error");
    }
  }

  async fetchHistory() {
    try {
      this._history = await this.api<HistoryEntry[]>("/history");
      this.notify();
    } catch (_e) {
      this.showToast("Failed to load history", "error");
    }
  }

  // Task operations
  async completeTask() {
    if (!this._currentTask) return;
    try {
      await this.api(`/tasks/${this._currentTask.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "completed" }),
      });
      this.showToast("Task completed!");
      await Promise.all([
        this.fetchNext(),
        this.fetchTasks(),
        this.fetchHistory(),
      ]);
    } catch (_e) {
      this.showToast("Failed to complete task", "error");
    }
  }

  async skipTask() {
    if (!this._currentTask) return;
    try {
      await this.api(`/tasks/${this._currentTask.id}/skip`, { method: "POST" });
      await this.fetchNext();
    } catch (_e) {
      this.showToast("Failed to skip task", "error");
    }
  }

  async deferTask(duration: string) {
    if (!this._currentTask || !duration) return;
    try {
      await this.api(`/tasks/${this._currentTask.id}/defer`, {
        method: "POST",
        body: JSON.stringify({ duration }),
      });
      this.showToast("Task deferred");
      await this.fetchNext();
    } catch (_e) {
      this.showToast("Failed to defer task", "error");
    }
  }

  async toggleComplete(task: Task) {
    try {
      const newStatus = task.completed_at ? "active" : "completed";
      await this.api(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      await Promise.all([
        this.fetchTasks(),
        this.fetchNext(),
        this.fetchHistory(),
      ]);
    } catch (_e) {
      this.showToast("Failed to update task", "error");
    }
  }

  async saveTask(data: Partial<Task>) {
    try {
      if (this._editingTask) {
        await this.api(`/tasks/${this._editingTask.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        this.showToast("Task updated");
      } else {
        await this.api("/tasks", {
          method: "POST",
          body: JSON.stringify(data),
        });
        this.showToast("Task created");
      }
      this._showTaskForm = false;
      this._editingTask = null;
      await Promise.all([
        this.fetchTasks(),
        this.fetchNext(),
        this.fetchProjects(),
      ]);
    } catch (_e) {
      this.showToast("Failed to save task", "error");
    }
  }

  async deleteTask(id: number) {
    try {
      await this.api(`/tasks/${id}`, { method: "DELETE" });
      this.showToast("Task deleted");
      this._showTaskForm = false;
      this._editingTask = null;
      await Promise.all([
        this.fetchTasks(),
        this.fetchNext(),
        this.fetchProjects(),
      ]);
    } catch (_e) {
      this.showToast("Failed to delete task", "error");
    }
  }

  // Project operations
  async saveProject(data: Partial<Project>) {
    try {
      if (this._editingProject) {
        await this.api(`/projects/${this._editingProject.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        this.showToast("Project updated");
      } else {
        await this.api("/projects", {
          method: "POST",
          body: JSON.stringify(data),
        });
        this.showToast("Project created");
      }
      this._showProjectForm = false;
      this._editingProject = null;
      await this.fetchProjects();
    } catch (_e) {
      this.showToast("Failed to save project", "error");
    }
  }

  async deleteProject(id: number) {
    try {
      await this.api(`/projects/${id}`, { method: "DELETE" });
      this.showToast("Project deleted");
      this._showProjectForm = false;
      this._editingProject = null;
      if (this._selectedProjectId === id) {
        this.navigate("inbox");
      }
      await Promise.all([this.fetchProjects(), this.fetchTasks()]);
    } catch (_e) {
      this.showToast("Failed to delete project", "error");
    }
  }

  // Context operations
  async saveContext(data: Partial<Context>) {
    try {
      if (this._editingContext) {
        await this.api(`/contexts/${this._editingContext.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        this.showToast("Context updated");
      } else {
        await this.api("/contexts", {
          method: "POST",
          body: JSON.stringify(data),
        });
        this.showToast("Context created");
      }
      this._showContextForm = false;
      this._editingContext = null;
      await this.fetchContexts();
    } catch (_e) {
      this.showToast("Failed to save context", "error");
    }
  }

  async deleteContext(id: number) {
    try {
      await this.api(`/contexts/${id}`, { method: "DELETE" });
      this.showToast("Context deleted");
      this._showContextForm = false;
      this._editingContext = null;
      if (this._selectedContextId === id) {
        this.navigate("inbox");
      }
      await Promise.all([this.fetchContexts(), this.fetchTasks()]);
    } catch (_e) {
      this.showToast("Failed to delete context", "error");
    }
  }

  // History operations
  async incompleteFromHistory(taskId: number) {
    try {
      await this.api(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      });
      this.showToast("Task reactivated");
      await Promise.all([
        this.fetchTasks(),
        this.fetchNext(),
        this.fetchHistory(),
      ]);
    } catch (_e) {
      this.showToast("Failed to incomplete task", "error");
    }
  }

  editTaskById(taskId: number) {
    const task = this._tasks.find((t) => t.id === taskId);
    if (task) {
      this.setShowTaskForm(true, task);
    }
  }

  // Import/Export
  exportData() {
    globalThis.location.href = "/api/export";
  }

  importData(file: File) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        await this.api("/import", {
          method: "POST",
          body: JSON.stringify(data),
        });
        this.showToast("Data imported");
        await this.fetchAll();
      } catch {
        this.showToast("Failed to import data", "error");
      }
    };
    reader.readAsText(file);
  }

  // Helpers
  getContextName(id: number): string {
    return this._contexts.find((c) => c.id === id)?.name || "";
  }

  getProjectName(id: number): string {
    return this._projects.find((p) => p.id === id)?.name || "";
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  isOverdue(dateStr: string): boolean {
    return new Date(dateStr) < new Date();
  }
}

// Singleton instance
export const store = new Store();
