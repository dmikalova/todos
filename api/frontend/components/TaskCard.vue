<script setup lang="ts">
import { computed } from "vue";
import type { Context, Project, Task } from "../api";
import { parseInlineMarkdown } from "../utils/markdown";

const props = withDefaults(defineProps<{
  task: Task;
  projects?: Project[];
  contexts?: Context[];
  selected?: boolean;
  showFull?: boolean;
}>(), {
  projects: () => [],
  contexts: () => [],
  selected: false,
  showFull: false,
});

const emit = defineEmits<{
  complete: [];
  delete: [];
  edit: [];
  click: [];
}>();

// Task project
const project = computed(() => {
  if (!props.task.projectId) return null;
  return props.projects.find((p) => p.id === props.task.projectId) || null;
});

// Task contexts
const taskContexts = computed(() => {
  if (!props.task.contextIds?.length) return [];
  return props.contexts.filter((c) => props.task.contextIds?.includes(c.id));
});

// Due date display
const dueDisplay = computed(() => {
  if (!props.task.dueDate) return null;

  const due = new Date(props.task.dueDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

  const isOverdue = due < today;
  const isToday = due >= today && due < tomorrow;
  const isTomorrow = due >= tomorrow && due < new Date(tomorrow.getTime() + 24 * 60 * 60 * 1000);
  const isThisWeek = due >= today && due < nextWeek;

  let label: string;
  if (isOverdue) {
    const daysAgo = Math.ceil((today.getTime() - due.getTime()) / (24 * 60 * 60 * 1000));
    label = daysAgo === 1 ? "Yesterday" : `${daysAgo} days ago`;
  } else if (isToday) {
    label = "Today";
  } else if (isTomorrow) {
    label = "Tomorrow";
  } else if (isThisWeek) {
    label = due.toLocaleDateString("en-US", { weekday: "long" });
  } else {
    label = due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  return {
    label,
    isOverdue,
    isToday,
  };
});

// Defer info
const deferredUntil = computed(() => {
  if (!props.task.deferredUntil) return null;
  const until = new Date(props.task.deferredUntil);
  return until.toLocaleDateString("en-US", { month: "short", day: "numeric" });
});

// Parsed title
const parsedTitle = computed(() => parseInlineMarkdown(props.task.title));
</script>

<template>
  <div
    @click="emit('click')"
    :class="[
      'group rounded-lg border bg-white p-4 transition-all',
      selected ? 'border-lime-500 ring-2 ring-lime-200' : 'border-gray-200 hover:border-gray-300',
      task.completedAt ? 'opacity-60' : '',
      showFull ? 'shadow-lg' : 'shadow-sm',
    ]"
  >
    <div class="flex items-start gap-3">
      <!-- Checkbox -->
      <button
        @click.stop="emit('complete')"
        :class="[
          'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors',
          task.completedAt
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-gray-300 hover:border-green-400',
        ]"
      >
        <svg v-if="task.completedAt" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </button>

      <!-- Content -->
      <div class="min-w-0 flex-1">
        <!-- Title -->
        <h3
          :class="[
            'text-sm font-medium',
            task.completedAt ? 'text-gray-500 line-through' : 'text-gray-900',
          ]"
          v-html="parsedTitle"
        />

        <!-- Notes (if showFull) -->
        <p
          v-if="showFull && task.notes"
          class="mt-2 text-sm text-gray-600 whitespace-pre-wrap"
        >
          {{ task.notes }}
        </p>

        <!-- Metadata -->
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <!-- Project badge -->
          <span
            v-if="project"
            class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
            :style="{
              backgroundColor: `${project.color}20`,
              color: project.color,
            }"
          >
            <span
              class="h-2 w-2 rounded-full"
              :style="{ backgroundColor: project.color }"
            />
            {{ project.name }}
          </span>

          <!-- Context badges -->
          <span
            v-for="ctx in taskContexts"
            :key="ctx.id"
            class="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600"
          >
            @{{ ctx.name }}
          </span>

          <!-- Due date -->
          <span
            v-if="dueDisplay"
            :class="[
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
              dueDisplay.isOverdue
                ? 'bg-red-100 text-red-700'
                : dueDisplay.isToday
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-600',
            ]"
          >
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {{ dueDisplay.label }}
          </span>

          <!-- Deferred badge -->
          <span
            v-if="deferredUntil"
            class="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700"
          >
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Deferred until {{ deferredUntil }}
          </span>

          <!-- Recurrence badge -->
          <span
            v-if="task.recurrenceId"
            class="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700"
          >
            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Recurring
          </span>
        </div>
      </div>

      <!-- Actions (visible on hover or when selected) -->
      <div
        :class="[
          'flex flex-shrink-0 gap-1',
          selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
        ]"
      >
        <button
          @click.stop="emit('edit')"
          class="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          title="Edit"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
        </button>
        <button
          v-if="!task.completedAt"
          @click.stop="emit('delete')"
          class="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
          title="Delete"
        >
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>
