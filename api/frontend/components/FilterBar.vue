<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import type { Context, Project } from "../api";

const props = defineProps<{
  projects: Project[];
  contexts: Context[];
}>();

// Model values
const search = defineModel<string>("search", { default: "" });
const projectId = defineModel<string | null>("projectId", { default: null });
const contextIds = defineModel<string[]>("contextIds", { default: () => [] });
const showCompleted = defineModel<boolean>("showCompleted", { default: false });
const dueFilter = defineModel<"all" | "overdue" | "today" | "week" | "none">("dueFilter", { default: "all" });

// Due filter options
const dueOptions = [
  { value: "all", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "today", label: "Due today" },
  { value: "week", label: "Due this week" },
  { value: "none", label: "No due date" },
] as const;

// Selected project name
function getProjectName(id: string | null): string {
  if (!id) return "All projects";
  const project = props.projects.find((p) => p.id === id);
  return project?.name || "Unknown";
}

// Toggle context
function toggleContext(id: string) {
  const idx = contextIds.value.indexOf(id);
  if (idx === -1) {
    contextIds.value = [...contextIds.value, id];
  } else {
    contextIds.value = contextIds.value.filter((c) => c !== id);
  }
}

// Clear all filters
function clearFilters() {
  search.value = "";
  projectId.value = null;
  contextIds.value = [];
  showCompleted.value = false;
  dueFilter.value = "all";
}

// Check if any filters are active
function hasActiveFilters(): boolean {
  return (
    search.value !== "" ||
    projectId.value !== null ||
    contextIds.value.length > 0 ||
    showCompleted.value !== false ||
    dueFilter.value !== "all"
  );
}
</script>

<template>
  <div class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-center gap-4">
      <!-- Search -->
      <div class="relative flex-1 min-w-[200px]">
        <svg
          class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          v-model="search"
          type="text"
          placeholder="Search tasks..."
          class="w-full rounded-md border-gray-300 pl-9 text-sm focus:border-lime-500 focus:ring-lime-500"
        />
      </div>

      <!-- Project Filter -->
      <Listbox v-model="projectId" as="div" class="relative">
        <ListboxButton
          class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {{ getProjectName(projectId) }}
          <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </ListboxButton>
        <transition
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute z-10 mt-1 max-h-60 w-48 overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          >
            <ListboxOption
              :value="null"
              v-slot="{ active, selected }"
              as="template"
            >
              <li
                :class="[
                  'cursor-pointer px-4 py-2 text-sm',
                  active ? 'bg-lime-50 text-lime-900' : 'text-gray-900',
                ]"
              >
                All projects
              </li>
            </ListboxOption>
            <ListboxOption
              v-for="project in projects"
              :key="project.id"
              :value="project.id"
              v-slot="{ active, selected }"
              as="template"
            >
              <li
                :class="[
                  'cursor-pointer px-4 py-2 text-sm flex items-center gap-2',
                  active ? 'bg-lime-50 text-lime-900' : 'text-gray-900',
                ]"
              >
                <span
                  class="h-3 w-3 rounded-full flex-shrink-0"
                  :style="{ backgroundColor: project.color || '#1976D2' }"
                />
                {{ project.name }}
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </Listbox>

      <!-- Due Date Filter -->
      <Listbox v-model="dueFilter" as="div" class="relative">
        <ListboxButton
          class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {{ dueOptions.find(o => o.value === dueFilter)?.label }}
          <svg class="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </ListboxButton>
        <transition
          leave-active-class="transition ease-in duration-100"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <ListboxOptions
            class="absolute z-10 mt-1 max-h-60 w-40 overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          >
            <ListboxOption
              v-for="option in dueOptions"
              :key="option.value"
              :value="option.value"
              v-slot="{ active }"
              as="template"
            >
              <li
                :class="[
                  'cursor-pointer px-4 py-2 text-sm',
                  active ? 'bg-lime-50 text-lime-900' : 'text-gray-900',
                ]"
              >
                {{ option.label }}
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </Listbox>

      <!-- Show Completed Toggle -->
      <label class="inline-flex items-center gap-2 cursor-pointer">
        <input
          v-model="showCompleted"
          type="checkbox"
          class="h-4 w-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
        />
        <span class="text-sm text-gray-700">Show completed</span>
      </label>

      <!-- Clear Filters -->
      <button
        v-if="hasActiveFilters()"
        @click="clearFilters"
        class="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        Clear filters
      </button>
    </div>

    <!-- Context Pills -->
    <div v-if="contexts.length > 0" class="mt-3 flex flex-wrap gap-2">
      <button
        v-for="context in contexts"
        :key="context.id"
        @click="toggleContext(context.id)"
        :class="[
          'rounded-full px-3 py-1 text-xs font-medium transition-colors',
          contextIds.includes(context.id)
            ? 'bg-lime-100 text-lime-700 ring-2 ring-lime-500'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        ]"
      >
        @{{ context.name }}
      </button>
    </div>
  </div>
</template>
