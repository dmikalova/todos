<script setup lang="ts">
import { ref, watch } from "vue";
import type { Context, Project, Task } from "../api";

const props = defineProps<{
  task?: Task | null;
  projects: Project[];
  contexts: Context[];
}>();

const emit = defineEmits<{
  save: [task: Partial<Task>];
  cancel: [];
}>();

// Form state
const formData = ref({
  title: "",
  notes: "",
  dueDate: "",
  projectId: null as string | null,
  contextIds: [] as string[],
});

// Initialize form when task changes
watch(
  () => props.task,
  (task) => {
    if (task) {
      formData.value = {
        title: task.title,
        notes: task.notes || "",
        dueDate: task.dueDate ? task.dueDate.split("T")[0] : "",
        projectId: task.projectId || null,
        contextIds: task.contextIds || [],
      };
    } else {
      formData.value = {
        title: "",
        notes: "",
        dueDate: "",
        projectId: null,
        contextIds: [],
      };
    }
  },
  { immediate: true }
);

// Toggle context selection
function toggleContext(contextId: string) {
  const idx = formData.value.contextIds.indexOf(contextId);
  if (idx === -1) {
    formData.value.contextIds.push(contextId);
  } else {
    formData.value.contextIds.splice(idx, 1);
  }
}

// Submit form
function submit() {
  if (!formData.value.title.trim()) return;

  const task: Partial<Task> = {
    title: formData.value.title.trim(),
  };

  if (formData.value.notes.trim()) {
    task.notes = formData.value.notes.trim();
  }

  if (formData.value.dueDate) {
    task.dueDate = formData.value.dueDate;
  }

  if (formData.value.projectId) {
    task.projectId = formData.value.projectId;
  }

  if (formData.value.contextIds.length > 0) {
    task.contextIds = formData.value.contextIds;
  }

  emit("save", task);
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <h3 class="mb-4 text-lg font-medium text-gray-900">
      {{ task ? "Edit Task" : "New Task" }}
    </h3>

    <form @submit.prevent="submit" class="space-y-4">
      <!-- Title -->
      <div>
        <label for="title" class="block text-sm font-medium text-gray-700">
          Title
        </label>
        <input
          id="title"
          v-model="formData.title"
          type="text"
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
          placeholder="What needs to be done?"
          autofocus
        />
      </div>

      <!-- Notes -->
      <div>
        <label for="notes" class="block text-sm font-medium text-gray-700">
          Notes <span class="text-gray-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          v-model="formData.notes"
          rows="3"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
          placeholder="Additional details..."
        />
      </div>

      <!-- Due Date -->
      <div>
        <label for="due-date" class="block text-sm font-medium text-gray-700">
          Due Date <span class="text-gray-400">(optional)</span>
        </label>
        <input
          id="due-date"
          v-model="formData.dueDate"
          type="date"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
        />
      </div>

      <!-- Project -->
      <div>
        <label for="project" class="block text-sm font-medium text-gray-700">
          Project
        </label>
        <select
          id="project"
          v-model="formData.projectId"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
        >
          <option :value="null">Inbox (no project)</option>
          <option v-for="project in projects" :key="project.id" :value="project.id">
            {{ project.name }}
          </option>
        </select>
      </div>

      <!-- Contexts -->
      <div>
        <label class="block text-sm font-medium text-gray-700">
          Contexts <span class="text-gray-400">(optional)</span>
        </label>
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            v-for="context in contexts"
            :key="context.id"
            type="button"
            @click="toggleContext(context.id)"
            :class="[
              'rounded-full px-3 py-1 text-sm font-medium transition-colors',
              formData.contextIds.includes(context.id)
                ? 'bg-lime-100 text-lime-700 ring-2 ring-lime-500'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            ]"
          >
            @{{ context.name }}
          </button>
          <span v-if="contexts.length === 0" class="text-sm text-gray-400">
            No contexts available
          </span>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          @click="emit('cancel')"
          class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="rounded-md bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-500"
        >
          {{ task ? "Update" : "Create" }}
        </button>
      </div>
    </form>
  </div>
</template>
