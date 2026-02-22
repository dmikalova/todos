<script setup lang="ts">
import { computed } from "vue";
import type { Context } from "../api";

const props = defineProps<{
  modelValue: string[];
  contexts: Context[];
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string[]];
}>();

const sortedContexts = computed(() => {
  return [...props.contexts].sort((a, b) => a.name.localeCompare(b.name));
});

function isSelected(contextId: string): boolean {
  return props.modelValue.includes(contextId);
}

function toggle(contextId: string): void {
  if (props.disabled) return;

  const newValue = isSelected(contextId)
    ? props.modelValue.filter((id) => id !== contextId)
    : [...props.modelValue, contextId];

  emit("update:modelValue", newValue);
}

function selectAll(): void {
  if (props.disabled) return;
  emit(
    "update:modelValue",
    props.contexts.map((c) => c.id),
  );
}

function clearAll(): void {
  if (props.disabled) return;
  emit("update:modelValue", []);
}
</script>

<template>
  <div>
    <!-- Quick actions -->
    <div class="mb-2 flex items-center gap-2 text-xs">
      <button
        type="button"
        @click="selectAll"
        :disabled="disabled"
        class="text-lime-600 hover:text-lime-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Select all
      </button>
      <span class="text-gray-300">|</span>
      <button
        type="button"
        @click="clearAll"
        :disabled="disabled"
        class="text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Clear
      </button>
    </div>

    <!-- Context pills -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="context in sortedContexts"
        :key="context.id"
        type="button"
        @click="toggle(context.id)"
        :disabled="disabled"
        :class="[
          'rounded-full px-3 py-1 text-sm font-medium transition-colors',
          isSelected(context.id)
            ? 'bg-lime-100 text-lime-700 ring-2 ring-lime-500'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
          disabled && 'opacity-50 cursor-not-allowed',
        ]"
      >
        @{{ context.name }}
      </button>
      <span v-if="contexts.length === 0" class="text-sm text-gray-400">
        No contexts available
      </span>
    </div>

    <!-- Selected count -->
    <p v-if="modelValue.length > 0" class="mt-2 text-xs text-gray-500">
      {{ modelValue.length }} context{{ modelValue.length === 1 ? "" : "s" }}
      selected
    </p>
  </div>
</template>
