// Reactive state store for the Todo app
// Uses a simple pub/sub pattern for Lit components

export interface Task {
  id: string;
  title: string;
  notes?: string;
  priority: number;
  status: string;
  due_date?: string;
  deferred_until?: string;
  project_id?: string;
  project_name?: string;
  recurrence_type?: string;
  recurrence_interval?: number;
  recurrence_days?: number[];
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

// Input type for API (camelCase)
export interface TaskInput {
  title: string;
  description?: string | null;
  projectId?: string | null;
  priority?: number;
  dueDate?: string | null;
  mustDo?: boolean;
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  description?: string | null;
  context_id?: string | null;
  parent_project_id?: string | null;
  task_count?: number;
}

export interface Context {
  id: string;
  name: string;
  color?: string;
  time_windows?: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
}

export interface HistoryEntry {
  id: string;
  task_id: string;
  task_title?: string;
  action: string;
  created_at: string;
}

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}

export interface UserProfile {
  email: string;
  name?: string;
  picture?: string;
}

type Listener = () => void;

class Store {
  // State
  private _tasks: Task[] = [];
  private _projects: Project[] = [];
  private _contexts: Context[] = [];
  private _history: HistoryEntry[] = [];
  private _historyTotal = 0;
  private _historyLoading = false;
  private _nextTasks: Task[] = [];
  private _loading = true;
  private _user: UserProfile | null = null;

  // UI State
  private _currentTab = "next";
  private _selectedProjectId: string | null = null;
  private _selectedContextId: string | null = null;
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
  get historyTotal() {
    return this._historyTotal;
  }
  get historyLoading() {
    return this._historyLoading;
  }
  get nextTasks() {
    return this._nextTasks;
  }
  get currentTask() {
    return this._nextTasks[0] || null;
  }
  get loading() {
    return this._loading;
  }
  get user() {
    return this._user;
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
    // Find projects that have this context (directly or inherited)
    const projectIds = this._projects
      .filter((p) => this.resolveProjectContext(p) === this._selectedContextId)
      .map((p) => p.id);
    return this._tasks.filter(
      (t) =>
        t.project_id && projectIds.includes(t.project_id) &&
        (this._taskFilter.completed === "true"
          ? t.completed_at
          : !t.completed_at),
    );
  }

  get currentPageTitle(): string {
    switch (this._currentTab) {
      case "next":
        return "next";
      case "inbox":
        return "inbox";
      case "due":
        return "due";
      case "history":
        return "history";
      case "settings":
        return "settings";
      case "project": {
        const p = this._projects.find((p) => p.id === this._selectedProjectId);
        return p?.name || "project";
      }
      case "context": {
        const c = this._contexts.find((c) => c.id === this._selectedContextId);
        return c?.name || "context";
      }
      default:
        return "todos";
    }
  }

  get currentBreadcrumb(): string | null {
    switch (this._currentTab) {
      case "project":
        return "Projects";
      case "context":
        return "Contexts";
      case "due":
        return "Filters";
      default:
        return null;
    }
  }

  get currentTitleEditable(): boolean {
    return this._currentTab === "project" || this._currentTab === "context";
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
  navigate(tab: string, id: string | null = null) {
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
        this._selectedProjectId = id;
      } else if (tab === "contexts" && id) {
        this._currentTab = "context";
        this._selectedContextId = id;
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
      const [nextResult, tasks, projects, contexts, historyResult] =
        await Promise.all([
          this.api<{ tasks: Task[]; totalEligible: number }>("/next"),
          this.api<Task[]>("/tasks"),
          this.api<Project[]>("/projects"),
          this.api<Context[]>("/contexts"),
          this.api<{ entries: HistoryEntry[]; total: number }>(
            "/history?limit=100&offset=0",
          ),
        ]);
      this._nextTasks = nextResult.tasks;
      this._tasks = tasks;
      this._projects = projects;
      this._contexts = contexts;
      this._history = historyResult.entries;
      this._historyTotal = historyResult.total;
    } catch (_e) {
      this.showToast("Failed to load data", "error");
    } finally {
      this._loading = false;
      this.notify();
    }
    this.fetchUser();
  }

  async fetchUser() {
    try {
      this._user = await fetch("/api/me").then((r) => r.json());
      this.notify();
    } catch (_e) {
      // non-critical
    }
  }

  async fetchNext() {
    try {
      const result = await this.api<{ tasks: Task[]; totalEligible: number }>(
        "/next",
      );
      this._nextTasks = result.tasks;
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
      const result = await this.api<{ entries: HistoryEntry[]; total: number }>(
        "/history?limit=100&offset=0",
      );
      this._history = result.entries;
      this._historyTotal = result.total;
      this.notify();
    } catch (_e) {
      this.showToast("Failed to load history", "error");
    }
  }

  async fetchMoreHistory(pageSize = 50) {
    if (this._historyLoading || this._history.length >= this._historyTotal) {
      return;
    }
    this._historyLoading = true;
    this.notify();
    try {
      const result = await this.api<{ entries: HistoryEntry[]; total: number }>(
        `/history?limit=${pageSize}&offset=${this._history.length}`,
      );
      this._history = [...this._history, ...result.entries];
      this._historyTotal = result.total;
    } catch (_e) {
      this.showToast("Failed to load more history", "error");
    } finally {
      this._historyLoading = false;
      this.notify();
    }
  }

  // Task operations
  async completeTask() {
    if (!this.currentTask) return;
    try {
      await this.api(`/tasks/${this.currentTask.id}/complete`, {
        method: "POST",
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
    if (!this.currentTask) return;
    try {
      await this.api(`/tasks/${this.currentTask.id}/skip`, { method: "POST" });
      await this.fetchNext();
    } catch (_e) {
      this.showToast("Failed to skip task", "error");
    }
  }

  async deferTask(duration: string) {
    if (!this.currentTask || !duration) return;
    try {
      await this.api(`/tasks/${this.currentTask.id}/defer`, {
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
      const isCompleted = !!task.completed_at;
      await this.api(`/tasks/${task.id}/complete`, {
        method: isCompleted ? "DELETE" : "POST",
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

  async saveTask(
    data: Partial<TaskInput>,
    recurrence?: {
      frequency: string;
      interval: number;
      daysOfWeek?: number[];
    } | null,
  ) {
    console.log("saveTask called with:", JSON.stringify(data, null, 2));
    console.log("recurrence:", recurrence);
    try {
      let taskId: string;

      if (this._editingTask) {
        console.log("Updating task:", this._editingTask.id);
        const result = await this.api(`/tasks/${this._editingTask.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        console.log("Update result:", result);
        taskId = this._editingTask.id;
        this.showToast("Task updated");
      } else {
        console.log("Creating new task");
        const created = await this.api<{ id: string }>("/tasks", {
          method: "POST",
          body: JSON.stringify(data),
        });
        console.log("Create result:", created);
        taskId = created.id;
        this.showToast("Task created");
      }

      // Handle recurrence
      await this.saveRecurrence(taskId, recurrence);

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

  private async saveRecurrence(
    taskId: string,
    recurrence?: {
      frequency: string;
      interval: number;
      daysOfWeek?: number[];
    } | null,
  ) {
    // Check if task already has recurrence
    let hasExisting = false;
    try {
      await this.api(`/recurrence/${taskId}`);
      hasExisting = true;
    } catch {
      hasExisting = false;
    }

    if (recurrence) {
      const payload = {
        scheduleType: "fixed",
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        daysOfWeek: recurrence.daysOfWeek,
      };

      if (hasExisting) {
        await this.api(`/recurrence/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await this.api("/recurrence", {
          method: "POST",
          body: JSON.stringify({ taskId, ...payload }),
        });
      }
    } else if (hasExisting) {
      // Remove recurrence if it existed but user cleared it
      await this.api(`/recurrence/${taskId}`, { method: "DELETE" });
    }
  }

  async deleteTask(id: string) {
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

  async deleteProject(id: string) {
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

  async deleteContext(id: string) {
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
  async incompleteFromHistory(taskId: string) {
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

  editTaskById(taskId: string) {
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
  getContextName(id: string): string {
    return this._contexts.find((c) => c.id === id)?.name || "";
  }

  getProjectName(id: string): string {
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

  // Context inheritance — walk parent_project_id ancestors to find nearest context_id
  resolveProjectContext(project: Project): string | null {
    if (project.context_id) return project.context_id;
    if (!project.parent_project_id) return null;
    const parent = this._projects.find((p) =>
      p.id === project.parent_project_id
    );
    if (!parent) return null;
    return this.resolveProjectContext(parent);
  }

  // Check if a time window is currently active
  isWindowActive(
    window: { dayOfWeek: number; startTime: string; endTime: string },
    now: Date = new Date(),
  ): boolean {
    if (now.getDay() !== window.dayOfWeek) return false;
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${
      String(now.getMinutes()).padStart(2, "0")
    }`;
    return hhmm >= window.startTime && hhmm < window.endTime;
  }

  // Return context IDs that have at least one active window right now
  getActiveContextIds(now: Date = new Date()): string[] {
    return this._contexts
      .filter((c) => {
        if (!c.time_windows || c.time_windows.length === 0) return true;
        return c.time_windows.some((w) => this.isWindowActive(w, now));
      })
      .map((c) => c.id);
  }

  // Filter projects whose effective context is in the active set
  getNextProjects(activeContextIds: string[]): Project[] {
    return this._projects.filter((p) => {
      const ctx = this.resolveProjectContext(p);
      return ctx !== null && activeContextIds.includes(ctx);
    });
  }

  // Return incomplete tasks in the given projects (excluding inbox/unassigned and future-dated)
  filterNextTasks(tasks: Task[], nextProjectIds: string[]): Task[] {
    const today = new Date().toISOString().split("T")[0];
    return tasks.filter(
      (t) =>
        t.project_id &&
        nextProjectIds.includes(t.project_id) &&
        !t.completed_at &&
        (!t.due_date || t.due_date.split("T")[0] <= today),
    );
  }

  // Sort by due date ascending, undated last
  sortNextTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });
  }

  // Full next pipeline: context windows → active projects → eligible tasks → sorted
  get pipelineTasks(): Task[] {
    const activeContextIds = this.getActiveContextIds();
    const nextProjects = this.getNextProjects(activeContextIds);
    const nextProjectIds = nextProjects.map((p) => p.id);
    const filtered = this.filterNextTasks(this._tasks, nextProjectIds);
    return this.sortNextTasks(filtered);
  }
}

// Singleton instance
export const store = new Store();
