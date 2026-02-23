<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { RecurrenceRule } from "../api";

const props = defineProps<{
  modelValue: Partial<RecurrenceRule> | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: Partial<RecurrenceRule> | null];
}>();

// Internal state
const enabled = ref(!!props.modelValue);
const scheduleType = ref<"fixed" | "completion">(
  props.modelValue?.schedule_type || "fixed",
);
const frequency = ref<"daily" | "weekly" | "monthly" | "yearly">(
  props.modelValue?.frequency || "weekly",
);
const interval = ref(props.modelValue?.interval || 1);
const dayOfWeek = ref<number | null>(props.modelValue?.day_of_week ?? null);
const dayOfMonth = ref<number | null>(props.modelValue?.day_of_month ?? null);
const monthOfYear = ref<number | null>(props.modelValue?.month_of_year ?? null);

// Watch for external changes
watch(
  () => props.modelValue,
  (newValue) => {
    enabled.value = !!newValue;
    if (newValue) {
      scheduleType.value = newValue.schedule_type || "fixed";
      frequency.value = newValue.frequency || "weekly";
      interval.value = newValue.interval || 1;
      dayOfWeek.value = newValue.day_of_week ?? null;
      dayOfMonth.value = newValue.day_of_month ?? null;
      monthOfYear.value = newValue.month_of_year ?? null;
    }
  },
  { deep: true },
);

// Emit changes
function emitUpdate(): void {
  if (!enabled.value) {
    emit("update:modelValue", null);
    return;
  }

  const rule: Partial<RecurrenceRule> = {
    schedule_type: scheduleType.value,
    frequency: frequency.value,
    interval: interval.value,
  };

  // Add optional fields based on frequency
  if (frequency.value === "weekly" && dayOfWeek.value !== null) {
    rule.day_of_week = dayOfWeek.value;
  }
  if (
    (frequency.value === "monthly" || frequency.value === "yearly") &&
    dayOfMonth.value !== null
  ) {
    rule.day_of_month = dayOfMonth.value;
  }
  if (frequency.value === "yearly" && monthOfYear.value !== null) {
    rule.month_of_year = monthOfYear.value;
  }

  emit("update:modelValue", rule);
}

// Watch all fields and emit on change
watch([enabled, scheduleType, frequency, interval, dayOfWeek, dayOfMonth, monthOfYear], emitUpdate);

// Day names for weekly selection
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Month names for yearly selection
const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Generate day of month options (1-31)
const daysOfMonth = Array.from({ length: 31 }, (_, i) => i + 1);

// Computed description of the recurrence
const description = computed(() => {
  if (!enabled.value) return "";

  const parts: string[] = [];

  if (scheduleType.value === "completion") {
    parts.push(`${interval.value} day${interval.value > 1 ? "s" : ""} after completion`);
  } else {
    // Fixed schedule
    if (frequency.value === "daily") {
      if (interval.value === 1) {
        parts.push("Every day");
      } else {
        parts.push(`Every ${interval.value} days`);
      }
    } else if (frequency.value === "weekly") {
      if (interval.value === 1) {
        parts.push("Every week");
      } else {
        parts.push(`Every ${interval.value} weeks`);
      }
      if (dayOfWeek.value !== null) {
        parts.push(`on ${dayNames[dayOfWeek.value]}`);
      }
    } else if (frequency.value === "monthly") {
      if (interval.value === 1) {
        parts.push("Every month");
      } else {
        parts.push(`Every ${interval.value} months`);
      }
      if (dayOfMonth.value !== null) {
        parts.push(`on the ${ordinal(dayOfMonth.value)}`);
      }
    } else if (frequency.value === "yearly") {
      if (interval.value === 1) {
        parts.push("Every year");
      } else {
        parts.push(`Every ${interval.value} years`);
      }
      if (monthOfYear.value !== null && dayOfMonth.value !== null) {
        parts.push(`on ${monthNames[monthOfYear.value - 1]} ${dayOfMonth.value}`);
      } else if (monthOfYear.value !== null) {
        parts.push(`in ${monthNames[monthOfYear.value - 1]}`);
      }
    }
  }

  return parts.join(" ");
});

// Helper for ordinal numbers
function ordinal(n: number): string {
  const s = ["th", "st", "and", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
</script>

<template>
  <div class="space-y-4">
    <!-- Enable/Disable Toggle -->
    <div class="flex items-center gap-3">
      <input
        id="recurrence-enabled"
        v-model="enabled"
        type="checkbox"
        :disabled="disabled"
        class="h-4 w-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
      />
      <label for="recurrence-enabled" class="text-sm font-medium text-gray-700">
        Repeat this task
      </label>
    </div>

    <template v-if="enabled">
      <!-- Schedule Type -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Repeat based on
        </label>
        <div class="flex gap-4">
          <label class="flex items-center">
            <input
              v-model="scheduleType"
              type="radio"
              value="fixed"
              :disabled="disabled"
              class="h-4 w-4 border-gray-300 text-lime-600 focus:ring-lime-500"
            />
            <span class="ml-2 text-sm text-gray-700">Fixed schedule</span>
          </label>
          <label class="flex items-center">
            <input
              v-model="scheduleType"
              type="radio"
              value="completion"
              :disabled="disabled"
              class="h-4 w-4 border-gray-300 text-lime-600 focus:ring-lime-500"
            />
            <span class="ml-2 text-sm text-gray-700">After completion</span>
          </label>
        </div>
      </div>

      <!-- Completion-based options -->
      <div v-if="scheduleType === 'completion'" class="flex items-center gap-2">
        <input
          v-model.number="interval"
          type="number"
          min="1"
          max="365"
          :disabled="disabled"
          class="w-20 rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
        />
        <span class="text-sm text-gray-700">days after completion</span>
      </div>

      <!-- Fixed schedule options -->
      <template v-else>
        <!-- Frequency -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Frequency
          </label>
          <div class="flex items-center gap-2">
            <span class="text-sm text-gray-700">Every</span>
            <input
              v-model.number="interval"
              type="number"
              min="1"
              max="99"
              :disabled="disabled"
              class="w-16 rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
            />
            <select
              v-model="frequency"
              :disabled="disabled"
              class="rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
            >
              <option value="daily">day{{ interval > 1 ? "s" : "" }}</option>
              <option value="weekly">week{{ interval > 1 ? "s" : "" }}</option>
              <option value="monthly">month{{ interval > 1 ? "s" : "" }}</option>
              <option value="yearly">year{{ interval > 1 ? "s" : "" }}</option>
            </select>
          </div>
        </div>

        <!-- Day of week (for weekly) -->
        <div v-if="frequency === 'weekly'">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            On day
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="(name, index) in dayNames"
              :key="index"
              type="button"
              @click="dayOfWeek = dayOfWeek === index ? null : index"
              :disabled="disabled"
              :class="[
                'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                dayOfWeek === index
                  ? 'bg-lime-100 text-lime-700 ring-2 ring-lime-500'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
                disabled && 'opacity-50 cursor-not-allowed',
              ]"
            >
              {{ name }}
            </button>
          </div>
          <p class="mt-1 text-xs text-gray-500">
            Leave unselected to use the task's due date day
          </p>
        </div>

        <!-- Day of month (for monthly/yearly) -->
        <div v-if="frequency === 'monthly' || frequency === 'yearly'">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            On day of month
          </label>
          <select
            v-model.number="dayOfMonth"
            :disabled="disabled"
            class="rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
          >
            <option :value="null">Same as due date</option>
            <option v-for="day in daysOfMonth" :key="day" :value="day">
              {{ ordinal(day) }}
            </option>
          </select>
          <p v-if="dayOfMonth && dayOfMonth > 28" class="mt-1 text-xs text-amber-600">
            For months with fewer days, the task will be scheduled on the last day
          </p>
        </div>

        <!-- Month of year (for yearly) -->
        <div v-if="frequency === 'yearly'">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            In month
          </label>
          <select
            v-model.number="monthOfYear"
            :disabled="disabled"
            class="rounded-md border-gray-300 shadow-sm focus:border-lime-500 focus:ring-lime-500 sm:text-sm"
          >
            <option :value="null">Same as due date</option>
            <option
              v-for="(name, index) in monthNames"
              :key="index"
              :value="index + 1"
            >
              {{ name }}
            </option>
          </select>
        </div>
      </template>

      <!-- Summary -->
      <div
        v-if="description"
        class="rounded-md bg-lime-50 border border-lime-200 p-3"
      >
        <p class="text-sm text-lime-700">
          <span class="font-medium">Summary:</span> {{ description }}
        </p>
      </div>
    </template>
  </div>
</template>
