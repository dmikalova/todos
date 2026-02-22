<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api, type HistoryEntry } from "../api";

// Data state
const history = ref<HistoryEntry[]>([]);
const stats = ref<{ date: string; count: number }[]>([]);
const loading = ref(true);

// Pagination
const offset = ref(0);
const limit = 50;
const hasMore = ref(true);

// Filters
const filters = ref({
  action: "all" as "all" | "create" | "update" | "complete" | "delete",
  startDate: "",
  endDate: "",
});

// Filtered history
const filteredHistory = computed(() => {
  let result = history.value;

  if (filters.value.action !== "all") {
    result = result.filter((h) => h.action === filters.value.action);
  }

  return result;
});

// Group by date
const groupedHistory = computed(() => {
  const groups: Record<string, HistoryEntry[]> = {};

  for (const entry of filteredHistory.value) {
    const date = new Date(entry.createdAt).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(entry);
  }

  return groups;
});

// Max stat value for chart scaling
const maxStatCount = computed(() => {
  return Math.max(...stats.value.map((s) => s.count), 1);
});

// Fetch data
async function fetchHistory() {
  loading.value = true;
  try {
    const params: Parameters<typeof api.history.list>[0] = {
      limit,
      offset: offset.value,
    };
    if (filters.value.action !== "all") {
      params.action = filters.value.action;
    }
    if (filters.value.startDate) {
      params.startDate = filters.value.startDate;
    }
    if (filters.value.endDate) {
      params.endDate = filters.value.endDate;
    }

    const data = await api.history.list(params);
    if (offset.value === 0) {
      history.value = data;
    } else {
      history.value = [...history.value, ...data];
    }
    hasMore.value = data.length === limit;
  } finally {
    loading.value = false;
  }
}

async function fetchStats() {
  try {
    stats.value = await api.history.stats();
  } catch (e) {
    stats.value = [];
  }
}

function loadMore() {
  offset.value += limit;
  fetchHistory();
}

function applyFilters() {
  offset.value = 0;
  fetchHistory();
}

// Format action for display
function formatAction(action: string): { label: string; color: string } {
  switch (action) {
    case "create":
      return { label: "Created", color: "bg-green-100 text-green-800" };
    case "update":
      return { label: "Updated", color: "bg-lime-100 text-lime-800" };
    case "complete":
      return { label: "Completed", color: "bg-purple-100 text-purple-800" };
    case "incomplete":
      return { label: "Reopened", color: "bg-yellow-100 text-yellow-800" };
    case "delete":
      return { label: "Deleted", color: "bg-red-100 text-red-800" };
    case "defer":
      return { label: "Deferred", color: "bg-amber-100 text-amber-800" };
    default:
      return { label: action, color: "bg-gray-100 text-gray-800" };
  }
}

// Format time
function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

// Format chart date
function formatChartDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

onMounted(() => {
  fetchHistory();
  fetchStats();
});
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8">
    <!-- Header -->
    <div class="mb-6">
      <h1 class="text-2xl font-bold text-gray-900">Activity History</h1>
      <p class="mt-1 text-sm text-gray-500">Track your task activity over time</p>
    </div>

    <!-- Activity Chart -->
    <div v-if="stats.length > 0" class="mb-8 rounded-lg border border-gray-200 bg-white p-4">
      <h3 class="mb-4 text-sm font-medium text-gray-700">Daily Activity (Last 14 Days)</h3>
      <div class="flex items-end gap-1 h-24">
        <div
          v-for="stat in stats"
          :key="stat.date"
          class="group relative flex-1"
        >
          <div
            class="w-full bg-lime-500 rounded-t transition-all hover:bg-lime-600"
            :style="{ height: `${(stat.count / maxStatCount) * 100}%`, minHeight: stat.count > 0 ? '4px' : '0' }"
          />
          <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
            <div class="rounded bg-gray-900 px-2 py-1 text-xs text-white whitespace-nowrap">
              {{ stat.count }} actions
              <br />
              {{ formatChartDate(stat.date) }}
            </div>
          </div>
        </div>
      </div>
      <div class="mt-2 flex justify-between text-xs text-gray-500">
        <span>{{ stats.length > 0 ? formatChartDate(stats[0].date) : "" }}</span>
        <span>{{ stats.length > 0 ? formatChartDate(stats[stats.length - 1].date) : "" }}</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="mb-6 flex flex-wrap items-center gap-4">
      <div>
        <label for="action-filter" class="sr-only">Action type</label>
        <select
          id="action-filter"
          v-model="filters.action"
          @change="applyFilters"
          class="rounded-md border-gray-300 text-sm focus:border-lime-500 focus:ring-lime-500"
        >
          <option value="all">All actions</option>
          <option value="create">Created</option>
          <option value="update">Updated</option>
          <option value="complete">Completed</option>
          <option value="delete">Deleted</option>
        </select>
      </div>
      <div>
        <label for="start-date" class="sr-only">Start date</label>
        <input
          id="start-date"
          v-model="filters.startDate"
          type="date"
          @change="applyFilters"
          class="rounded-md border-gray-300 text-sm focus:border-lime-500 focus:ring-lime-500"
          placeholder="Start date"
        />
      </div>
      <div>
        <label for="end-date" class="sr-only">End date</label>
        <input
          id="end-date"
          v-model="filters.endDate"
          type="date"
          @change="applyFilters"
          class="rounded-md border-gray-300 text-sm focus:border-lime-500 focus:ring-lime-500"
          placeholder="End date"
        />
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading && offset === 0" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-lime-600 border-t-transparent"></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredHistory.length === 0"
      class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center"
    >
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No activity yet</h3>
      <p class="mt-2 text-sm text-gray-500">
        Your task activity will appear here
      </p>
    </div>

    <!-- History Timeline -->
    <div v-else class="space-y-8">
      <div v-for="(entries, date) in groupedHistory" :key="date">
        <h3 class="mb-4 text-sm font-medium text-gray-500">{{ date }}</h3>
        <div class="space-y-3">
          <div
            v-for="entry in entries"
            :key="entry.id"
            class="flex items-start gap-4 rounded-lg border border-gray-200 bg-white p-4"
          >
            <div class="flex-shrink-0">
              <span
                :class="[
                  'inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium',
                  formatAction(entry.action).color,
                ]"
              >
                {{ formatAction(entry.action).label }}
              </span>
            </div>
            <div class="min-w-0 flex-1">
              <p class="font-medium text-gray-900">
                {{ entry.taskTitle || "Unknown task" }}
              </p>
              <p v-if="entry.details" class="mt-1 text-sm text-gray-500">
                {{ typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details) }}
              </p>
            </div>
            <div class="flex-shrink-0 text-sm text-gray-500">
              {{ formatTime(entry.createdAt) }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Load More -->
    <div v-if="hasMore && !loading && filteredHistory.length > 0" class="mt-8 text-center">
      <button
        @click="loadMore"
        class="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Load more
      </button>
    </div>

    <!-- Loading indicator for pagination -->
    <div v-if="loading && offset > 0" class="mt-8 flex justify-center">
      <div class="h-6 w-6 animate-spin rounded-full border-2 border-lime-600 border-t-transparent"></div>
    </div>
  </div>
</template>
