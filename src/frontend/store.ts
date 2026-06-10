// Reactive state store for the Todo app
// Uses a simple pub/sub pattern for Lit components

export interface Task {
  id: string;
  title: string;
  priority: number;
  status: string;
  due_date?: string;
  deferred_until?: string;
  project_id?: string;
  project_name?: string;
  context_ids: string[];
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
  projectId?: string | null;
  priority?: number;
  dueDate?: string | null;
  contextIds?: string[];
}

export interface Project {
  id: string;
  name: string;
  color?: string;
  description?: string | null;
  context_ids: string[];
  parent_project_id?: string | null;
  sort_order: number;
  task_count?: number;
}

export interface Context {
  id: string;
  name: string;
  color?: string;
  task_count?: number;
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

export interface ProjectTreeEntry {
  project: Project;
  depth: number;
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

export interface DueDateWithin {
  amount: number;
  unit: "days" | "weeks" | "months" | "years";
}

export interface FilterCriteria {
  priorities?: number[];
  projects?: string[];
  dueDateWithin?: DueDateWithin;
  contexts?: string[];
  tags?: string[];
  completed?: boolean;
  hasRecurrence?: boolean;
}

export interface SavedFilter {
  id: string;
  name: string;
  color: string | null;
  filter: FilterCriteria;
  task_count?: number;
  created_at: string;
}

type Listener = () => void;

class Store {
  // State
  private _tasks: Task[] = [];
  private _projects: Project[] = [];
  private _contexts: Context[] = [];
  private _savedFilters: SavedFilter[] = [];
  private _history: HistoryEntry[] = [];
  private _historyTotal = 0;
  private _historyLoading = false;
  private _nextTask: Task | null = null;
  private _loading = true;
  private _user: UserProfile | null = null;
  private _timezone = "UTC";

  // UI State
  private _currentTab = "next";
  private _selectedProjectId: string | null = null;
  private _selectedContextId: string | null = null;
  private _selectedFilterId: string | null = null;
  private _sidebarOpen = false;
  private _showTaskForm = false;
  private _showProjectForm = false;
  private _showContextForm = false;
  private _showFilterForm = false;
  private _showSearch = false;
  private _editingTask: Task | null = null;
  private _editingProject: Project | null = null;
  private _editingContext: Context | null = null;
  private _editingFilter: SavedFilter | null = null;
  private _toasts: Toast[] = [];
  private _taskFilter = { completed: "false" };
  private _collapsedProjectIds: Set<string> = new Set();
  private _collapsedSections: Set<string> = new Set();

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
  get currentTask() {
    return this._nextTask;
  }
  get loading() {
    return this._loading;
  }
  get user() {
    return this._user;
  }
  get timezone() {
    return this._timezone;
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
  get savedFilters() {
    return this._savedFilters;
  }
  get showFilterForm() {
    return this._showFilterForm;
  }
  get editingFilter() {
    return this._editingFilter;
  }
  get selectedFilterId() {
    return this._selectedFilterId;
  }
  get selectedFilter() {
    return this._savedFilters.find((f) => f.id === this._selectedFilterId) ||
      null;
  }
  get toasts() {
    return this._toasts;
  }
  get taskFilter() {
    return this._taskFilter;
  }

  get collapsedProjectIds(): Set<string> {
    return this._collapsedProjectIds;
  }

  get collapsedSections(): Set<string> {
    return this._collapsedSections;
  }

  toggleSectionCollapse(sectionId: string) {
    if (this._collapsedSections.has(sectionId)) {
      this._collapsedSections.delete(sectionId);
    } else {
      this._collapsedSections.add(sectionId);
    }
    this.notify();
  }

  // Computed: depth-annotated flat list of projects ordered as a tree.
  // Siblings maintain their sort_order from the API. Children of collapsed parents excluded.
  get projectTree(): ProjectTreeEntry[] {
    const entries: ProjectTreeEntry[] = [];
    const childrenMap = new Map<string | null, Project[]>();

    // Group projects by parent
    for (const project of this._projects) {
      const parentId = project.parent_project_id ?? null;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(project);
    }

    // DFS traversal to build flat list
    const visit = (parentId: string | null, depth: number) => {
      const children = childrenMap.get(parentId);
      if (!children) return;
      for (const project of children) {
        entries.push({ project, depth });
        if (!this._collapsedProjectIds.has(project.id)) {
          visit(project.id, depth + 1);
        }
      }
    };

    visit(null, 0);
    return entries;
  }

  // Returns all recursive descendant project IDs for a given project
  getDescendantIds(projectId: string): string[] {
    const descendants: string[] = [];
    const childrenMap = new Map<string | null, Project[]>();

    for (const project of this._projects) {
      const parentId = project.parent_project_id ?? null;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(project);
    }

    const collect = (id: string) => {
      const children = childrenMap.get(id);
      if (!children) return;
      for (const child of children) {
        descendants.push(child.id);
        collect(child.id);
      }
    };

    collect(projectId);
    return descendants;
  }

  // Check if a project has any children
  hasChildren(projectId: string): boolean {
    return this._projects.some((p) => p.parent_project_id === projectId);
  }

  // Toggle collapse state for a project
  toggleCollapse(projectId: string) {
    if (this._collapsedProjectIds.has(projectId)) {
      this._collapsedProjectIds.delete(projectId);
    } else {
      this._collapsedProjectIds.add(projectId);
    }
    this._persistCollapsedState();
    this.notify();
  }

  // Persist collapsed state to localStorage
  private _persistCollapsedState() {
    try {
      const ids = Array.from(this._collapsedProjectIds);
      globalThis.localStorage?.setItem(
        "tasks:collapsedProjects",
        JSON.stringify(ids),
      );
    } catch {
      // localStorage may not be available
    }
  }

  // Restore collapsed state from localStorage
  restoreCollapsedState() {
    try {
      const raw = globalThis.localStorage?.getItem("tasks:collapsedProjects");
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        this._collapsedProjectIds = new Set(ids);
      }
    } catch {
      // localStorage may not be available or data may be corrupt
    }
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

  get nextCount(): number {
    const activeContextIds = new Set(
      this._contexts.filter((c) => this.isContextActive(c)).map((c) => c.id),
    );
    return this._tasks.filter(
      (t) =>
        !t.completed_at &&
        (!t.deferred_until || new Date(t.deferred_until) <= new Date()) &&
        (t.context_ids.some((id) => activeContextIds.has(id)) ||
          (t.project_id &&
            this._projects.find((p) => p.id === t.project_id)?.context_ids
              ?.some((id) => activeContextIds.has(id)))),
    ).length;
  }

  // Check if a context is currently active based on its time windows.
  // No time windows = always active. Otherwise, must match current day/time.
  isContextActive(context: Context): boolean {
    if (!context.time_windows || context.time_windows.length === 0) {
      return true;
    }
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS
    return context.time_windows.some(
      (tw) =>
        tw.dayOfWeek === dayOfWeek &&
        tw.startTime <= currentTime &&
        tw.endTime > currentTime,
    );
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

  get filteredTasks(): Task[] {
    const filter = this.selectedFilter;
    if (!filter) return [];
    const criteria = filter.filter;
    let tasks = this._tasks.filter((t) => !t.completed_at);

    if (criteria.priorities && criteria.priorities.length > 0) {
      tasks = tasks.filter((t) => criteria.priorities!.includes(t.priority));
    }
    if (criteria.projects && criteria.projects.length > 0) {
      tasks = tasks.filter((t) =>
        criteria.projects!.includes(t.project_id || "")
      );
    }
    if (criteria.dueDateWithin) {
      const cutoff = this.computeCutoffDate(criteria.dueDateWithin);
      tasks = tasks.filter((t) => {
        return t.due_date && new Date(t.due_date) <= cutoff;
      });
    }
    if (criteria.completed !== undefined) {
      tasks = tasks.filter(
        (t) => (t.completed_at !== null) === criteria.completed,
      );
    }
    return tasks.sort(
      (a, b) =>
        (a.due_date ? new Date(a.due_date).getTime() : Infinity) -
        (b.due_date ? new Date(b.due_date).getTime() : Infinity),
    );
  }

  get filteredTaskCount(): number {
    return this.filteredTasks.length;
  }

  private computeCutoffDate(within: DueDateWithin): Date {
    const now = new Date();
    const cutoff = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      23,
      59,
      59,
      999,
    );
    switch (within.unit) {
      case "days":
        cutoff.setDate(cutoff.getDate() + within.amount);
        break;
      case "weeks":
        cutoff.setDate(cutoff.getDate() + within.amount * 7);
        break;
      case "months":
        cutoff.setMonth(cutoff.getMonth() + within.amount);
        break;
      case "years":
        cutoff.setFullYear(cutoff.getFullYear() + within.amount);
        break;
    }
    return cutoff;
  }

  get projectTasks(): Task[] {
    if (!this._selectedProjectId) return [];
    return this._tasks.filter(
      (t) =>
        t.project_id === this._selectedProjectId &&
        (this._taskFilter.completed === ""
          ? true
          : this._taskFilter.completed === "true"
          ? t.completed_at
          : !t.completed_at),
    );
  }

  private _contextTasks: Task[] = [];

  get contextTasks(): Task[] {
    return this._contextTasks;
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
      case "filter": {
        const f = this._savedFilters.find(
          (f) => f.id === this._selectedFilterId,
        );
        return f?.name || "filter";
      }
      default:
        return "tasks";
    }
  }

  get currentBreadcrumb(): string | null {
    switch (this._currentTab) {
      case "next":
      case "inbox":
        return "tasks";
      case "project":
        return "projects";
      case "context":
        return "contexts";
      case "filter":
        return "filters";
    }
    return null;
  }

  get currentTitleEditable(): boolean {
    return this._currentTab === "project" || this._currentTab === "context" ||
      this._currentTab === "filter";
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
      const error = await res.json().catch(() => ({ error: "unknown error" }));
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
      this._selectedFilterId = null;
      history.pushState({}, "", `/projects/${id}`);
    } else if (tab === "context") {
      this._selectedContextId = id;
      this._selectedFilterId = null;
      history.pushState({}, "", `/contexts/${id}`);
      this.fetchContextTasks(id!);
    } else if (tab === "filter") {
      this._selectedFilterId = id;
      this._selectedProjectId = null;
      this._selectedContextId = null;
      history.pushState({}, "", `/filters/${id}`);
    } else {
      this._selectedProjectId = null;
      this._selectedContextId = null;
      this._selectedFilterId = null;
      history.pushState({}, "", `/${tab}`);
      if (tab === "next") {
        this.fetchNext();
      }
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
        this.fetchContextTasks(id);
      } else if (tab === "filters" && id) {
        this._currentTab = "filter";
        this._selectedFilterId = id;
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

  setShowFilterForm(show: boolean, filter: SavedFilter | null = null) {
    this._showFilterForm = show;
    this._editingFilter = filter;
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
    this.restoreCollapsedState();
    try {
      const [nextResult, tasks, projects, contexts, filters, historyResult] =
        await Promise.all([
          this.api<{ task: Task | null }>("/next"),
          this.api<Task[]>("/tasks"),
          this.api<Project[]>("/projects"),
          this.api<Context[]>("/contexts"),
          this.api<SavedFilter[]>("/filters"),
          this.api<{ entries: HistoryEntry[]; total: number }>(
            "/history?limit=100&offset=0",
          ),
        ]);
      this._nextTask = nextResult.task;
      this._tasks = tasks;
      this._projects = projects;
      this._contexts = contexts;
      this._savedFilters = filters;
      this._history = historyResult.entries;
      this._historyTotal = historyResult.total;
    } catch (_e) {
      this.showToast("failed to load data", "error");
    } finally {
      this._loading = false;
      this.notify();
    }
    this.fetchUser();
    this.fetchSettings();
  }

  async fetchUser() {
    try {
      this._user = await fetch("/api/me").then((r) => r.json());
      this.notify();
    } catch (_e) {
      // non-critical
    }
  }

  async fetchSettings() {
    try {
      const result = await this.api<{ timezone: string }>("/settings");
      this._timezone = result.timezone;
      this.notify();
    } catch (_e) {
      // non-critical - use default
    }
  }

  async updateTimezone(timezone: string) {
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone }),
      });
      this._timezone = timezone;
      this.notify();
      this.showToast("timezone updated");
    } catch (_e) {
      this.showToast("failed to update timezone", "error");
    }
  }

  async fetchNext() {
    try {
      const result = await this.api<{ task: Task | null }>(
        "/next",
      );
      this._nextTask = result.task;
      this.notify();
    } catch (_e) {
      this.showToast("failed to load next task", "error");
    }
  }

  async fetchTasks() {
    try {
      this._tasks = await this.api<Task[]>("/tasks");
      this.notify();
    } catch (_e) {
      this.showToast("failed to load tasks", "error");
    }
  }

  async fetchProjects() {
    try {
      this._projects = await this.api<Project[]>("/projects");
      this.notify();
    } catch (_e) {
      this.showToast("failed to load projects", "error");
    }
  }

  async moveProject(
    projectId: string,
    parentProjectId: string | null,
    sortOrder: number,
  ) {
    try {
      await this.api(`/projects/${projectId}`, {
        method: "PATCH",
        body: JSON.stringify({ parentProjectId, sortOrder }),
      });
      await this.fetchProjects();
    } catch {
      this.showToast("failed to move project", "error");
    }
  }

  async fetchContexts() {
    try {
      this._contexts = await this.api<Context[]>("/contexts");
      this.notify();
    } catch (_e) {
      this.showToast("failed to load contexts", "error");
    }
  }

  async fetchContextTasks(contextId?: string) {
    const id = contextId || this._selectedContextId;
    if (!id) return;
    try {
      const completed = this._taskFilter.completed === "true"
        ? "true"
        : this._taskFilter.completed === "false"
        ? "false"
        : "";
      const params = completed ? `?completed=${completed}` : "";
      this._contextTasks = await this.api<Task[]>(
        `/contexts/${id}/tasks${params}`,
      );
      this.notify();
    } catch (_e) {
      this.showToast("failed to load context tasks", "error");
    }
  }

  async reorderContexts(contextIds: string[]) {
    try {
      await this.api("/contexts/reorder", {
        method: "PATCH",
        body: JSON.stringify({ contextIds }),
      });
      await this.fetchContexts();
    } catch (_e) {
      this.showToast("failed to reorder contexts", "error");
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
      this.showToast("failed to load history", "error");
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
      this.showToast("failed to load more history", "error");
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
      this.showToast("task completed!");
      await Promise.all([
        this.fetchNext(),
        this.fetchTasks(),
        this.fetchHistory(),
      ]);
    } catch (_e) {
      this.showToast("failed to complete task", "error");
    }
  }

  async deferTask(duration: string) {
    if (!this.currentTask || !duration) return;
    try {
      await this.api(`/tasks/${this.currentTask.id}/defer`, {
        method: "POST",
        body: JSON.stringify({ duration }),
      });
      this.showToast("task deferred");
      await this.fetchNext();
    } catch (_e) {
      this.showToast("failed to defer task", "error");
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
        this.fetchContexts(),
        this._selectedContextId ? this.fetchContextTasks() : Promise.resolve(),
      ]);
    } catch (_e) {
      this.showToast("failed to update task", "error");
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
        this.showToast("task updated");
      } else {
        console.log("Creating new task");
        const created = await this.api<{ id: string }>("/tasks", {
          method: "POST",
          body: JSON.stringify(data),
        });
        console.log("Create result:", created);
        taskId = created.id;
        this.showToast("task created");
      }

      // Handle recurrence
      const isNew = !this._editingTask;
      await this.saveRecurrence(taskId, recurrence, isNew);

      this._showTaskForm = false;
      this._editingTask = null;
      await Promise.all([
        this.fetchTasks(),
        this.fetchNext(),
        this.fetchProjects(),
        this.fetchContexts(),
        this._selectedContextId ? this.fetchContextTasks() : Promise.resolve(),
      ]);
    } catch (_e) {
      this.showToast("failed to save task", "error");
    }
  }

  private async saveRecurrence(
    taskId: string,
    recurrence?: {
      frequency: string;
      interval: number;
      daysOfWeek?: number[];
    } | null,
    isNew = false,
  ) {
    if (recurrence) {
      const payload = {
        scheduleType: "fixed",
        frequency: recurrence.frequency,
        interval: recurrence.interval,
        daysOfWeek: recurrence.daysOfWeek,
      };

      if (isNew || !this._editingTask?.recurrence_type) {
        // New task or task without existing recurrence — create
        await this.api("/recurrence", {
          method: "POST",
          body: JSON.stringify({ taskId, ...payload }),
        });
      } else {
        // Task already has recurrence — update
        await this.api(`/recurrence/${taskId}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      }
    } else if (!isNew && this._editingTask?.recurrence_type) {
      // Recurrence was cleared — delete it
      await this.api(`/recurrence/${taskId}`, { method: "DELETE" });
    }
  }

  async deleteTask(id: string) {
    try {
      await this.api(`/tasks/${id}`, { method: "DELETE" });
      this.showToast("task deleted");
      this._showTaskForm = false;
      this._editingTask = null;
      await Promise.all([
        this.fetchTasks(),
        this.fetchNext(),
        this.fetchProjects(),
        this.fetchContexts(),
        this._selectedContextId ? this.fetchContextTasks() : Promise.resolve(),
      ]);
    } catch (_e) {
      this.showToast("failed to delete task", "error");
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
        this.showToast("project updated");
      } else {
        await this.api("/projects", {
          method: "POST",
          body: JSON.stringify(data),
        });
        this.showToast("project created");
      }
      this._showProjectForm = false;
      this._editingProject = null;
      await Promise.all([this.fetchProjects(), this.fetchNext()]);
    } catch (_e) {
      this.showToast("failed to save project", "error");
    }
  }

  async deleteProject(id: string) {
    try {
      await this.api(`/projects/${id}`, { method: "DELETE" });
      this.showToast("project deleted");
      this._showProjectForm = false;
      this._editingProject = null;
      if (this._selectedProjectId === id) {
        this.navigate("inbox");
      }
      await Promise.all([this.fetchProjects(), this.fetchTasks()]);
    } catch (_e) {
      this.showToast("failed to delete project", "error");
    }
  }

  // Context operations
  async saveContext(data: {
    name?: string;
    color?: string;
    timeWindows?: Array<
      { dayOfWeek: number; startTime: string; endTime: string }
    >;
  }) {
    try {
      if (this._editingContext) {
        await this.api(`/contexts/${this._editingContext.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        this.showToast("context updated");
      } else {
        await this.api("/contexts", {
          method: "POST",
          body: JSON.stringify(data),
        });
        this.showToast("context created");
      }
      this._showContextForm = false;
      this._editingContext = null;
      await Promise.all([this.fetchContexts(), this.fetchNext()]);
    } catch (_e) {
      this.showToast("failed to save context", "error");
    }
  }

  async deleteContext(id: string) {
    try {
      await this.api(`/contexts/${id}`, { method: "DELETE" });
      this.showToast("context deleted");
      this._showContextForm = false;
      this._editingContext = null;
      if (this._selectedContextId === id) {
        this.navigate("inbox");
      }
      await Promise.all([this.fetchContexts(), this.fetchTasks()]);
    } catch (_e) {
      this.showToast("failed to delete context", "error");
    }
  }

  // Filter operations
  async fetchFilters() {
    try {
      this._savedFilters = await this.api<SavedFilter[]>("/filters");
      this.notify();
    } catch (_e) {
      // Filters may not be available
    }
  }

  async saveFilter(data: {
    name: string;
    color: string;
    criteria: FilterCriteria;
  }) {
    try {
      if (this._editingFilter) {
        await this.api(`/filters/${this._editingFilter.id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        });
        this.showToast("filter updated");
      } else {
        await this.api("/filters", {
          method: "POST",
          body: JSON.stringify(data),
        });
        this.showToast("filter created");
      }
      this._showFilterForm = false;
      this._editingFilter = null;
      await this.fetchFilters();
    } catch (_e) {
      this.showToast("failed to save filter", "error");
    }
  }

  async deleteFilter(id: string) {
    try {
      await this.api(`/filters/${id}`, { method: "DELETE" });
      this.showToast("filter deleted");
      this._showFilterForm = false;
      this._editingFilter = null;
      if (this._selectedFilterId === id) {
        this.navigate("inbox");
      }
      await this.fetchFilters();
    } catch (_e) {
      this.showToast("failed to delete filter", "error");
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
        this.showToast("data imported");
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

  // Check if a time window is currently active
  isWindowActive(
    window: { dayOfWeek: number; startTime: string; endTime: string },
    now: Date = new Date(),
  ): boolean {
    if (now.getDay() !== window.dayOfWeek) return false;
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${
      String(
        now.getMinutes(),
      ).padStart(2, "0")
    }`;
    return hhmm >= window.startTime && hhmm < window.endTime;
  }
}

// Singleton instance
export const store = new Store();
