<script setup lang="ts">
import { computed } from "vue";
import type { Project } from "../api";

const props = defineProps<{
  modelValue: string | null;
  projects: Project[];
  placeholder?: string;
  allowInbox?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
}>();

const selectedProject = computed({
  get: () => props.modelValue,
  set: (value) => emit("update:modelValue", value),
});

const sortedProjects = computed(() => {
  return [...props.projects].sort((a, b) => a.name.localeCompare(b.name));
});
</script>

<template>
  <select
    v-model="selectedProject"
    class="block w-full rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
  >
    <option v-if="allowInbox !== false" :value="null">
      {{ placeholder || "Inbox (no project)" }}
    </option>
    <option
      v-for="project in sortedProjects"
      :key="project.id"
      :value="project.id"
    >
      {{ project.name }}
      <template v-if="project.task_count !== undefined">
        ({{ project.task_count }})
      </template>
    </option>
  </select>
</template>
