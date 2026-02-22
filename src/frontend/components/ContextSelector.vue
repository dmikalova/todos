<script setup lang="ts">
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "@headlessui/vue";
import { computed } from "vue";
import type { Context } from "../api";

const props = defineProps<{
  contexts: Context[];
  currentContextId: string | null;
  manualOverride: string | null;
}>();

const emit = defineEmits<{
  "update:manualOverride": [value: string | null];
}>();

// Find context by ID
function getContextById(id: string | null): Context | null {
  if (!id) return null;
  return props.contexts.find((c) => c.id === id) || null;
}

// Current context (either manual override or auto-detected)
const activeContext = computed(() => {
  if (props.manualOverride) {
    return getContextById(props.manualOverride);
  }
  return getContextById(props.currentContextId);
});

// Is currently in override mode?
const isOverride = computed(() => !!props.manualOverride);

// Sort contexts alphabetically
const sortedContexts = computed(() => {
  return [...props.contexts].sort((a, b) => a.name.localeCompare(b.name));
});

// Select handler
function selectContext(contextId: string | null): void {
  emit("update:manualOverride", contextId);
}

// Clear override
function clearOverride(): void {
  emit("update:manualOverride", null);
}
</script>

<template>
  <div class="relative">
    <Listbox :model-value="manualOverride || currentContextId" @update:model-value="selectContext">
      <div class="relative">
        <ListboxButton
          :class="[
            'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
            isOverride
              ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-400'
              : activeContext
                ? 'bg-lime-100 text-lime-700'
                : 'bg-gray-100 text-gray-600',
          ]"
        >
          <span v-if="activeContext">@{{ activeContext.name }}</span>
          <span v-else class="text-gray-500">Any context</span>

          <!-- Override indicator -->
          <span
            v-if="isOverride"
            class="ml-1 rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-800"
          >
            override
          </span>

          <!-- Dropdown arrow -->
          <svg
            class="h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </ListboxButton>

        <transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="transform scale-95 opacity-0"
          enter-to-class="transform scale-100 opacity-100"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="transform scale-100 opacity-100"
          leave-to-class="transform scale-95 opacity-0"
        >
          <ListboxOptions
            class="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
          >
            <!-- Clear override option -->
            <ListboxOption
              v-if="isOverride"
              :value="null"
              as="template"
              v-slot="{ active }"
            >
              <li
                :class="[
                  active ? 'bg-amber-50 text-amber-900' : 'text-gray-700',
                  'cursor-pointer select-none px-4 py-2 text-sm border-b border-gray-100',
                ]"
              >
                <div class="flex items-center gap-2">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear override (use auto-detect)
                </div>
              </li>
            </ListboxOption>

            <!-- "Any context" option -->
            <ListboxOption
              :value="null"
              as="template"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  active ? 'bg-lime-50 text-lime-900' : 'text-gray-700',
                  'cursor-pointer select-none px-4 py-2 text-sm',
                ]"
              >
                <div class="flex items-center justify-between">
                  <span :class="{ 'font-semibold': selected && !manualOverride && !currentContextId }">
                    Any context
                  </span>
                  <svg
                    v-if="selected && !manualOverride && !currentContextId"
                    class="h-4 w-4 text-lime-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </li>
            </ListboxOption>

            <!-- Divider -->
            <div class="border-t border-gray-100" />

            <!-- Context options -->
            <ListboxOption
              v-for="context in sortedContexts"
              :key="context.id"
              :value="context.id"
              as="template"
              v-slot="{ active, selected }"
            >
              <li
                :class="[
                  active ? 'bg-lime-50 text-lime-900' : 'text-gray-700',
                  'cursor-pointer select-none px-4 py-2 text-sm',
                ]"
              >
                <div class="flex items-center justify-between">
                  <span :class="{ 'font-semibold': selected }">
                    @{{ context.name }}
                  </span>
                  <div class="flex items-center gap-2">
                    <!-- Auto-detected indicator -->
                    <span
                      v-if="context.id === currentContextId && !manualOverride"
                      class="text-xs text-gray-400"
                    >
                      auto
                    </span>
                    <svg
                      v-if="selected"
                      class="h-4 w-4 text-lime-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>
                <p v-if="context.description" class="mt-0.5 text-xs text-gray-500">
                  {{ context.description }}
                </p>
              </li>
            </ListboxOption>
          </ListboxOptions>
        </transition>
      </div>
    </Listbox>
  </div>
</template>
