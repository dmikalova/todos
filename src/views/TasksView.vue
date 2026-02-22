<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api, type Context, type Project, type Task } from "../api";
import FilterBar from "../components/FilterBar.vue";
import TaskCard from "../components/TaskCard.vue";
import TaskForm from "../components/TaskForm.vue";
import { registerShortcut, unregisterShortcut } from "../composables/useKeyboardShortcuts";

const route = useRoute();
const router = useRouter();

// Data state
const tasks = ref<Task[]>([]);
const projects = ref<Project[]>([]);
const contexts = ref<Context[]>([]);
const loading = ref(true);

// UI state
const editingTaskId = ref<string | null>(null);
const showAddForm = ref(false);
const selectedTaskIndex = ref(-1);

// Filters
const filters = ref({
  search: "",
  projectId: null as string | null,
  contextIds: [] as string[],
  showCompleted: false,
  showDeleted: false,
  dueFilter: "all" as "all" | "overdue" | "today" | "week" | "none",
});

// Filtered tasks
const filteredTasks = computed(() => {
  let result = tasks.value;

  // Hide completed/deleted by default
  if (!filters.value.showCompleted) {
    result = result.filter((t) => !t.completedAt);
  }
  if (!filters.value.showDeleted) {
    result = result.filter((t) => !t.deletedAt);
  }

  // Search filter
  if (filters.value.search) {
    const search = filters.value.search.toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(search));
  }

  // Project filter
  if (filters.value.projectId) {
    result = result.filter((t) => t.projectId === filters.value.projectId);
  }

  // Context filter
  if (filters.value.contextIds.length > 0) {
    result = result.filter((t) =>
      t.contextIds?.some((id) => filters.value.contextIds.includes(id))
    );
  }

  // Due date filter
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekEnd = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  switch (filters.value.dueFilter) {
    case "overdue":
      result = result.filter((t) => t.dueDate && new Date(t.dueDate) < today);
      break;
    case "today":
      result = result.filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due >= today && due < new Date(today.getTime() + 24 * 60 * 60 * 1000);
      });
      break;
    case "week":
      result = result.filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due >= today && due < weekEnd;
      });
      break;
    case "none":
      result = result.filter((t) => !t.dueDate);
      break;
  }

  return result;
});

// Fetch data
async function fetchTasks() {
  loading.value = true;
  try {
    const [taskData, projectData, contextData] = await Promise.all([
      api.tasks.list({ includeCompleted: true }),
      api.projects.list(),
      api.contexts.list(),
    ]);
    tasks.value = taskData;
    projects.value = projectData;
    contexts.value = contextData;
  } finally {
    loading.value = false;
  }
}

// Task actions
async function completeTask(task: Task) {
  if (task.completedAt) {
    await api.tasks.incomplete(task.id);
  } else {
    await api.tasks.complete(task.id);
  }
  await fetchTasks();
}

async function deleteTask(task: Task) {
  await api.tasks.delete(task.id);
  await fetchTasks();
}

async function saveTask(task: Partial<Task>) {
  if (editingTaskId.value) {
    await api.tasks.update(editingTaskId.value, task);
  } else {
    await api.tasks.create(task as Omit<Task, "id" | "createdAt" | "updatedAt">);
  }
  editingTaskId.value = null;
  showAddForm.value = false;
  await fetchTasks();
}

function cancelEdit() {
  editingTaskId.value = null;
  showAddForm.value = false;
}

function editTask(taskId: string) {
  editingTaskId.value = taskId;
  showAddForm.value = false;
}

// Keyboard navigation
function selectNext() {
  if (selectedTaskIndex.value < filteredTasks.value.length - 1) {
    selectedTaskIndex.value++;
  }
}

function selectPrevious() {
  if (selectedTaskIndex.value > 0) {
    selectedTaskIndex.value--;
  }
}

function completeSelected() {
  if (selectedTaskIndex.value >= 0 && selectedTaskIndex.value < filteredTasks.value.length) {
    completeTask(filteredTasks.value[selectedTaskIndex.value]);
  }
}

function editSelected() {
  if (selectedTaskIndex.value >= 0 && selectedTaskIndex.value < filteredTasks.value.length) {
    editTask(filteredTasks.value[selectedTaskIndex.value].id);
  }
}

// Watch route for edit param
watch(
  () => route.query.edit,
  (editId) => {
    if (editId && typeof editId === "string") {
      editingTaskId.value = editId;
    }
  },
  { immediate: true }
);

// Register keyboard shortcuts
onMounted(() => {
  fetchTasks();

  registerShortcut("a", "Add new task", () => { showAddForm.value = true; });
  registerShortcut("j", "Select next task", selectNext);
  registerShortcut("k", "Select previous task", selectPrevious);
  registerShortcut("x", "Complete selected task", completeSelected);
  registerShortcut("e", "Edit selected task", editSelected);
  registerShortcut("Escape", "Cancel / Clear selection", () => {
    if (showAddForm.value || editingTaskId.value) {
      cancelEdit();
    } else {
      selectedTaskIndex.value = -1;
    }
  });
});

onUnmounted(() => {
  unregisterShortcut("a");
  unregisterShortcut("j");
  unregisterShortcut("k");
  unregisterShortcut("x");
  unregisterShortcut("e");
  unregisterShortcut("Escape");
});

// Helper to get task being edited
const editingTask = computed(() => {
  if (!editingTaskId.value) return null;
  return tasks.value.find((t) => t.id === editingTaskId.value) || null;
});
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Tasks</h1>
      <button
        @click="showAddForm = true"
        class="inline-flex items-center gap-2 rounded-md bg-lime-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-lime-500"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Task
        <kbd class="ml-1 rounded bg-lime-700 px-1.5 py-0.5 text-xs">a</kbd>
      </button>
    </div>

    <!-- Filter Bar -->
    <FilterBar
      v-model:search="filters.search"
      v-model:project-id="filters.projectId"
      v-model:context-ids="filters.contextIds"
      v-model:show-completed="filters.showCompleted"
      v-model:due-filter="filters.dueFilter"
      :projects="projects"
      :contexts="contexts"
      class="mb-6"
    />

    <!-- Add Task Form -->
    <div v-if="showAddForm" class="mb-6">
      <TaskForm
        :projects="projects"
        :contexts="contexts"
        @save="saveTask"
        @cancel="cancelEdit"
      />
    </div>

    <!-- Edit Task Form -->
    <div v-if="editingTask && !showAddForm" class="mb-6">
      <TaskForm
        :task="editingTask"
        :projects="projects"
        :contexts="contexts"
        @save="saveTask"
        @cancel="cancelEdit"
      />
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-lime-600 border-t-transparent"></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredTasks.length === 0"
      class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center"
    >
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No tasks found</h3>
      <p class="mt-2 text-sm text-gray-500">
        {{ tasks.length > 0 ? "Try adjusting your filters" : "Get started by creating your first task" }}
      </p>
    </div>

    <!-- Task List -->
    <div v-else class="space-y-3">
      <TaskCard
        v-for="(task, index) in filteredTasks"
        :key="task.id"
        :task="task"
        :selected="index === selectedTaskIndex"
        :projects="projects"
        :contexts="contexts"
        @complete="completeTask(task)"
        @delete="deleteTask(task)"
        @edit="editTask(task.id)"
        @click="selectedTaskIndex = index"
      />
    </div>

    <!-- Task Count -->
    <div v-if="!loading && filteredTasks.length > 0" class="mt-6 text-center text-sm text-gray-500">
      Showing {{ filteredTasks.length }} of {{ tasks.length }} tasks
    </div>
  </div>
</template>
