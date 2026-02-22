<script setup lang="ts">
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/vue";
import { computed, ref } from "vue";

const emit = defineEmits<{
  defer: [deferUntil: string];
}>();

// Compute defer options relative to today
const deferOptions = computed(() => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const nextMonth = new Date(today);
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  // Find next Monday
  const nextMonday = new Date(today);
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));

  // Find next Saturday
  const nextSaturday = new Date(today);
  nextSaturday.setDate(nextSaturday.getDate() + ((6 - nextSaturday.getDay() + 7) % 7 || 7));

  return [
    { label: "Later today", value: formatDate(today), description: "4 hours" },
    { label: "Tomorrow", value: formatDate(tomorrow), description: formatDayName(tomorrow) },
    { label: "Next Monday", value: formatDate(nextMonday), description: formatShortDate(nextMonday) },
    { label: "This weekend", value: formatDate(nextSaturday), description: formatShortDate(nextSaturday) },
    { label: "Next week", value: formatDate(nextWeek), description: formatShortDate(nextWeek) },
    { label: "Next month", value: formatDate(nextMonth), description: formatShortDate(nextMonth) },
  ];
});

// Custom date input
const showCustom = ref(false);
const customDate = ref("");

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatDayName(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function selectOption(value: string) {
  emit("defer", value);
}

function selectCustom() {
  if (customDate.value) {
    emit("defer", customDate.value);
    customDate.value = "";
    showCustom.value = false;
  }
}
</script>

<template>
  <Menu as="div" class="relative inline-block text-left">
    <MenuButton as="template">
      <slot />
    </MenuButton>

    <transition
      enter-active-class="transition ease-out duration-100"
      enter-from-class="transform opacity-0 scale-95"
      enter-to-class="transform opacity-100 scale-100"
      leave-active-class="transition ease-in duration-75"
      leave-from-class="transform opacity-100 scale-100"
      leave-to-class="transform opacity-0 scale-95"
    >
      <MenuItems
        class="absolute left-0 z-10 mt-2 w-56 origin-top-left rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
      >
        <div class="py-1">
          <MenuItem
            v-for="option in deferOptions"
            :key="option.value"
            v-slot="{ active }"
          >
            <button
              @click="selectOption(option.value)"
              :class="[
                'flex w-full items-center justify-between px-4 py-2 text-sm',
                active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
              ]"
            >
              <span>{{ option.label }}</span>
              <span class="text-gray-400 text-xs">{{ option.description }}</span>
            </button>
          </MenuItem>

          <div class="border-t border-gray-100 my-1" />

          <MenuItem v-slot="{ active }">
            <div
              :class="[
                'px-4 py-2',
                active ? 'bg-gray-100' : '',
              ]"
            >
              <div v-if="!showCustom">
                <button
                  @click.stop="showCustom = true"
                  class="text-sm text-gray-700 hover:text-gray-900"
                >
                  Pick a date...
                </button>
              </div>
              <div v-else class="flex items-center gap-2">
                <input
                  v-model="customDate"
                  type="date"
                  class="flex-1 rounded border-gray-300 text-sm focus:border-lime-500 focus:ring-lime-500"
                  @click.stop
                />
                <button
                  @click.stop="selectCustom"
                  :disabled="!customDate"
                  class="rounded bg-lime-600 px-2 py-1 text-xs font-medium text-white hover:bg-lime-500 disabled:opacity-50"
                >
                  Set
                </button>
              </div>
            </div>
          </MenuItem>
        </div>
      </MenuItems>
    </transition>
  </Menu>
</template>
