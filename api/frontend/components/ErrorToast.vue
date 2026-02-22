<script setup lang="ts">
import { ref } from "vue";

// Global error state
const errors = ref<{ id: number; message: string }[]>([]);
let nextId = 1;

// Listen for error events
function showError(message: string, duration = 5000) {
  const id = nextId++;
  errors.value.push({ id, message });

  setTimeout(() => {
    errors.value = errors.value.filter((e) => e.id !== id);
  }, duration);
}

function dismissError(id: number) {
  errors.value = errors.value.filter((e) => e.id !== id);
}

// Global error handler - catch API errors
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason?.name === "ApiError") {
      showError(event.reason.message);
      event.preventDefault();
    }
  });
}

// Expose for external use
defineExpose({ showError });
</script>

<template>
  <div
    class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-md px-4"
    aria-live="assertive"
  >
    <transition-group
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 -translate-y-4"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-4"
    >
      <div
        v-for="error in errors"
        :key="error.id"
        class="rounded-lg bg-red-50 p-4 shadow-lg ring-1 ring-red-200"
      >
        <div class="flex items-start">
          <div class="flex-shrink-0">
            <svg
              class="h-5 w-5 text-red-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fill-rule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                clip-rule="evenodd"
              />
            </svg>
          </div>
          <div class="ml-3 flex-1">
            <p class="text-sm font-medium text-red-800">
              {{ error.message }}
            </p>
          </div>
          <div class="ml-4 flex-shrink-0">
            <button
              type="button"
              @click="dismissError(error.id)"
              class="rounded-md bg-red-50 text-red-500 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
            >
              <span class="sr-only">Dismiss</span>
              <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </transition-group>
  </div>
</template>
