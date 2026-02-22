<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { api, type Project, type Task } from "../api";
import { registerShortcut, unregisterShortcut } from "../composables/useKeyboardShortcuts";

// Data state
const projects = ref<(Project & { taskCount?: number })[]>([]);
const inboxTasks = ref<Task[]>([]);
const loading = ref(true);

// UI state
const showAddForm = ref(false);
const editingProjectId = ref<string | null>(null);
const selectedIndex = ref(-1);

// Form state
const formData = ref({
  name: "",
  description: "",
  color: "#1976D2",
});

// Color options (Material Design)
const colorOptions = [
  { name: "Blue", value: "#1976D2" },
  { name: "Red", value: "#D32F2F" },
  { name: "Green", value: "#388E3C" },
  { name: "Purple", value: "#7B1FA2" },
  { name: "Orange", value: "#F57C00" },
  { name: "Teal", value: "#00796B" },
  { name: "Pink", value: "#C2185B" },
  { name: "Indigo", value: "#303F9F" },
];

// Fetch data
async function fetchProjects() {
  loading.value = true;
  try {
    const [projectData, inbox] = await Promise.all([
      api.projects.list(),
      api.projects.getInbox(),
    ]);
    projects.value = projectData;
    inboxTasks.value = inbox;
  } finally {
    loading.value = false;
  }
}

// Project actions
async function createProject() {
  await api.projects.create({
    name: formData.value.name,
    description: formData.value.description || undefined,
    color: formData.value.color,
  });
  resetForm();
  await fetchProjects();
}

async function updateProject() {
  if (!editingProjectId.value) return;
  await api.projects.update(editingProjectId.value, {
    name: formData.value.name,
    description: formData.value.description || undefined,
    color: formData.value.color,
  });
  resetForm();
  await fetchProjects();
}

async function deleteProject(id: string) {
  if (!confirm("Delete this project? Tasks will be moved to Inbox.")) return;
  await api.projects.delete(id);
  await fetchProjects();
}

function editProject(project: Project) {
  editingProjectId.value = project.id;
  formData.value = {
    name: project.name,
    description: project.description || "",
    color: project.color || "#1976D2",
  };
  showAddForm.value = false;
}

function resetForm() {
  showAddForm.value = false;
  editingProjectId.value = null;
  formData.value = {
    name: "",
    description: "",
    color: "#1976D2",
  };
}

function submitForm() {
  if (editingProjectId.value) {
    updateProject();
  } else {
    createProject();
  }
}

// Keyboard navigation
function selectNext() {
  if (selectedIndex.value < projects.value.length - 1) {
    selectedIndex.value++;
  }
}

function selectPrevious() {
  if (selectedIndex.value > 0) {
    selectedIndex.value--;
  }
}

function editSelected() {
  if (selectedIndex.value >= 0 && selectedIndex.value < projects.value.length) {
    editProject(projects.value[selectedIndex.value]);
  }
}

// Register keyboard shortcuts
onMounted(() => {
  fetchProjects();

  registerShortcut("a", "Add new project", () => { showAddForm.value = true; });
  registerShortcut("j", "Select next project", selectNext);
  registerShortcut("k", "Select previous project", selectPrevious);
  registerShortcut("e", "Edit selected project", editSelected);
  registerShortcut("Escape", "Cancel / Clear selection", () => {
    if (showAddForm.value || editingProjectId.value) {
      resetForm();
    } else {
      selectedIndex.value = -1;
    }
  });
});

onUnmounted(() => {
  unregisterShortcut("a");
  unregisterShortcut("j");
  unregisterShortcut("k");
  unregisterShortcut("e");
  unregisterShortcut("Escape");
});
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <!-- Header -->
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-2xl font-bold text-gray-900">Projects</h1>
      <button
        @click="showAddForm = true"
        class="inline-flex items-center gap-2 rounded-md bg-lime-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-lime-500"
      >
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Add Project
        <kbd class="ml-1 rounded bg-lime-700 px-1.5 py-0.5 text-xs">a</kbd>
      </button>
    </div>

    <!-- Add/Edit Form -->
    <div
      v-if="showAddForm || editingProjectId"
      class="mb-6 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
    >
      <h3 class="mb-4 text-lg font-medium text-gray-900">
        {{ editingProjectId ? "Edit Project" : "New Project" }}
      </h3>
      <form @submit.prevent="submitForm" class="space-y-4">
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700">Name</label>
          <input
            id="name"
            v-model="formData.name"
            type="text"
            required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
            placeholder="Project name"
          />
        </div>
        <div>
          <label for="description" class="block text-sm font-medium text-gray-700">
            Description <span class="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="description"
            v-model="formData.description"
            rows="2"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
            placeholder="Brief description"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700">Color</label>
          <div class="mt-2 flex flex-wrap gap-2">
            <button
              v-for="color in colorOptions"
              :key="color.value"
              type="button"
              @click="formData.color = color.value"
              :class="[
                'h-8 w-8 rounded-full border-2 transition-transform',
                formData.color === color.value ? 'scale-110 border-gray-800' : 'border-transparent hover:scale-105',
              ]"
              :style="{ backgroundColor: color.value }"
              :title="color.name"
            />
          </div>
        </div>
        <div class="flex justify-end gap-3">
          <button
            type="button"
            @click="resetForm"
            class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-md bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-500"
          >
            {{ editingProjectId ? "Update" : "Create" }}
          </button>
        </div>
      </form>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-lime-600 border-t-transparent"></div>
    </div>

    <template v-else>
      <!-- Inbox Section -->
      <div class="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-200">
              <svg class="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <div>
              <h3 class="font-medium text-gray-900">Inbox</h3>
              <p class="text-sm text-gray-500">Tasks without a project</p>
            </div>
          </div>
          <span class="rounded-full bg-gray-200 px-3 py-1 text-sm font-medium text-gray-700">
            {{ inboxTasks.length }} tasks
          </span>
        </div>
      </div>

      <!-- Projects List -->
      <div v-if="projects.length === 0" class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
        </svg>
        <h3 class="mt-4 text-lg font-medium text-gray-900">No projects yet</h3>
        <p class="mt-2 text-sm text-gray-500">
          Create projects to organize your tasks
        </p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="(project, index) in projects"
          :key="project.id"
          @click="selectedIndex = index"
          :class="[
            'rounded-lg border bg-white p-4 shadow-sm transition-all cursor-pointer',
            index === selectedIndex ? 'border-lime-500 ring-2 ring-lime-200' : 'border-gray-200 hover:border-gray-300',
          ]"
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="h-10 w-10 rounded-lg"
                :style="{ backgroundColor: project.color || '#1976D2' }"
              />
              <div>
                <h3 class="font-medium text-gray-900">{{ project.name }}</h3>
                <p v-if="project.description" class="text-sm text-gray-500">
                  {{ project.description }}
                </p>
              </div>
            </div>
            <div class="flex items-center gap-4">
              <span class="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
                {{ project.taskCount ?? 0 }} tasks
              </span>
              <div class="flex gap-2">
                <button
                  @click.stop="editProject(project)"
                  class="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title="Edit project"
                >
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  @click.stop="deleteProject(project.id)"
                  class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                  title="Delete project"
                >
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Project Count -->
      <div v-if="projects.length > 0" class="mt-6 text-center text-sm text-gray-500">
        {{ projects.length }} project{{ projects.length === 1 ? "" : "s" }}
      </div>
    </template>
  </div>
</template>
