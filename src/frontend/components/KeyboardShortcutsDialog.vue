<script setup lang="ts">
import {
  Dialog,
  DialogPanel,
  DialogTitle,
  TransitionChild,
  TransitionRoot,
} from "@headlessui/vue";
import { computed, onMounted, ref } from "vue";
import { getAllShortcuts, type ShortcutInfo } from "../composables/useKeyboardShortcuts";

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const shortcuts = ref<ShortcutInfo[]>([]);

// Group shortcuts by category
const groupedShortcuts = computed(() => {
  const groups: Record<string, ShortcutInfo[]> = {
    Navigation: [],
    Tasks: [],
    Actions: [],
    Other: [],
  };

  for (const shortcut of shortcuts.value) {
    const desc = shortcut.description.toLowerCase();
    if (desc.includes("go to") || desc.includes("navigate") || desc.includes("next") || desc.includes("previous")) {
      groups.Navigation.push(shortcut);
    } else if (desc.includes("task") || desc.includes("complete") || desc.includes("delete") || desc.includes("edit") || desc.includes("add")) {
      groups.Tasks.push(shortcut);
    } else if (desc.includes("save") || desc.includes("cancel") || desc.includes("search") || desc.includes("filter")) {
      groups.Actions.push(shortcut);
    } else {
      groups.Other.push(shortcut);
    }
  }

  // Remove empty groups
  return Object.fromEntries(
    Object.entries(groups).filter(([_, items]) => items.length > 0)
  );
});

// Format key combination for display
function formatKeys(keys: string): string {
  return keys
    .split(" ")
    .map((key) => {
      switch (key) {
        case "Escape": return "Esc";
        case "Enter": return "↵";
        case "ArrowUp": return "↑";
        case "ArrowDown": return "↓";
        case "ArrowLeft": return "←";
        case "ArrowRight": return "→";
        default: return key;
      }
    })
    .join(" then ");
}

onMounted(() => {
  shortcuts.value = getAllShortcuts();
});
</script>

<template>
  <TransitionRoot as="template" :show="open">
    <Dialog as="div" class="relative z-50" @close="emit('close')">
      <TransitionChild
        as="template"
        enter="ease-out duration-300"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="ease-in duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
      >
        <div class="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
      </TransitionChild>

      <div class="fixed inset-0 z-10 overflow-y-auto">
        <div class="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
          <TransitionChild
            as="template"
            enter="ease-out duration-300"
            enter-from="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enter-to="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leave-from="opacity-100 translate-y-0 sm:scale-100"
            leave-to="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <DialogPanel class="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
              <div class="flex items-start justify-between">
                <DialogTitle as="h3" class="text-lg font-semibold leading-6 text-gray-900">
                  Keyboard Shortcuts
                </DialogTitle>
                <button
                  type="button"
                  @click="emit('close')"
                  class="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-lime-500 focus:ring-offset-2"
                >
                  <span class="sr-only">Close</span>
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div class="mt-4 space-y-6">
                <p class="text-sm text-gray-500">
                  Press keys in sequence (like Gmail shortcuts). Press <kbd class="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-semibold">?</kbd> anytime to see this help.
                </p>

                <div v-for="(items, group) in groupedShortcuts" :key="group">
                  <h4 class="mb-2 text-sm font-medium text-gray-700">{{ group }}</h4>
                  <dl class="space-y-1">
                    <div
                      v-for="shortcut in items"
                      :key="shortcut.keys"
                      class="flex items-center justify-between rounded px-2 py-1.5 hover:bg-gray-50"
                    >
                      <dt class="text-sm text-gray-600">{{ shortcut.description }}</dt>
                      <dd class="ml-4 flex-shrink-0">
                        <span
                          v-for="(key, idx) in formatKeys(shortcut.keys).split(' then ')"
                          :key="idx"
                          class="inline-flex items-center"
                        >
                          <kbd class="rounded border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-700 shadow-sm">
                            {{ key }}
                          </kbd>
                          <span v-if="idx < formatKeys(shortcut.keys).split(' then ').length - 1" class="mx-1 text-gray-400 text-xs">
                            then
                          </span>
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                <div v-if="Object.keys(groupedShortcuts).length === 0" class="text-center text-sm text-gray-500">
                  No shortcuts registered yet. Navigate to different pages to see available shortcuts.
                </div>
              </div>

              <div class="mt-6 flex justify-end">
                <button
                  type="button"
                  @click="emit('close')"
                  class="rounded-md bg-lime-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-lime-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-600"
                >
                  Got it
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </div>
    </Dialog>
  </TransitionRoot>
</template>
