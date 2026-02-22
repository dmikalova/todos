<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api, type ScoredTask } from "../api";
import DeferMenu from "../components/DeferMenu.vue";
import TaskCard from "../components/TaskCard.vue";
import { registerShortcut, unregisterShortcut } from "../composables/useKeyboardShortcuts";

const router = useRouter();

const currentTask = ref<ScoredTask | null>(null);
const explanation = ref<{ factors: Array<{ name: string; contribution: number; description: string }>; totalScore: number } | null>(null);
const loading = ref(true);
const showExplanation = ref(false);

// Fetch next task
async function fetchNext() {
  loading.value = true;
  try {
    currentTask.value = await api.next.get();
    explanation.value = null;
    showExplanation.value = false;
  } catch (e) {
    currentTask.value = null;
  } finally {
    loading.value = false;
  }
}

// Fetch task explanation
async function fetchExplanation() {
  if (!currentTask.value) return;
  try {
    explanation.value = await api.next.explain(currentTask.value.id);
    showExplanation.value = true;
  } catch (e) {
    // Ignore
  }
}

// Complete current task
async function completeTask() {
  if (!currentTask.value) return;
  await api.tasks.complete(currentTask.value.id);
  await fetchNext();
}

// Defer task
async function deferTask(deferUntil: string) {
  if (!currentTask.value) return;
  await api.tasks.defer(currentTask.value.id, deferUntil);
  await fetchNext();
}

// Skip to random task
async function skipToRandom() {
  loading.value = true;
  try {
    currentTask.value = await api.next.random();
    explanation.value = null;
    showExplanation.value = false;
  } catch (e) {
    currentTask.value = null;
  } finally {
    loading.value = false;
  }
}

// Edit task
function editTask() {
  if (!currentTask.value) return;
  router.push({ path: "/tasks", query: { edit: currentTask.value.id } });
}

// Register keyboard shortcuts
onMounted(() => {
  fetchNext();

  registerShortcut("c", "Complete task", completeTask);
  registerShortcut("e", "Edit task", editTask);
  registerShortcut("s", "Skip to random task", skipToRandom);
  registerShortcut("i", "Show score explanation", fetchExplanation);
  registerShortcut("n", "Get next task", fetchNext);
});

onUnmounted(() => {
  unregisterShortcut("c");
  unregisterShortcut("e");
  unregisterShortcut("s");
  unregisterShortcut("i");
  unregisterShortcut("n");
});

// Format score factor
function formatContribution(contribution: number): string {
  const pct = Math.round(contribution * 100);
  return pct >= 0 ? `+${pct}%` : `${pct}%`;
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8">
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-bold text-gray-900">What's Next?</h1>
      <p class="mt-2 text-sm text-gray-500">
        Your most important task right now
      </p>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="flex justify-center py-12">
      <div class="h-8 w-8 animate-spin rounded-full border-4 border-lime-600 border-t-transparent"></div>
    </div>

    <!-- No Tasks -->
    <div v-else-if="!currentTask" class="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">All caught up!</h3>
      <p class="mt-2 text-sm text-gray-500">
        No pending tasks. Enjoy your free time or add new tasks.
      </p>
      <router-link
        to="/tasks"
        class="mt-4 inline-flex items-center rounded-md bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-500"
      >
        View all tasks
      </router-link>
    </div>

    <!-- Current Task -->
    <div v-else class="space-y-6">
      <TaskCard
        :task="currentTask"
        show-full
        class="shadow-lg"
      />

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center justify-center gap-3">
        <button
          @click="completeTask"
          class="inline-flex items-center gap-2 rounded-lg bg-green-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          Complete
          <kbd class="ml-1 rounded bg-green-700 px-1.5 py-0.5 text-xs">c</kbd>
        </button>

        <DeferMenu @defer="deferTask">
          <button class="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-400">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Defer
          </button>
        </DeferMenu>

        <button
          @click="skipToRandom"
          class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Skip
          <kbd class="ml-1 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">s</kbd>
        </button>

        <button
          @click="editTask"
          class="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-200"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          Edit
          <kbd class="ml-1 rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">e</kbd>
        </button>
      </div>

      <!-- Score Explanation Toggle -->
      <div class="text-center">
        <button
          @click="fetchExplanation"
          class="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          Why this task? <kbd class="rounded bg-gray-100 px-1 text-xs">i</kbd>
        </button>
      </div>

      <!-- Score Explanation Panel -->
      <div
        v-if="showExplanation && explanation"
        class="rounded-lg bg-gray-50 p-4"
      >
        <h4 class="mb-3 text-sm font-medium text-gray-700">Score Breakdown</h4>
        <div class="space-y-2">
          <div
            v-for="factor in explanation.factors"
            :key="factor.name"
            class="flex items-center justify-between text-sm"
          >
            <div>
              <span class="font-medium text-gray-700">{{ factor.name }}</span>
              <span class="ml-2 text-gray-500">{{ factor.description }}</span>
            </div>
            <span
              :class="[
                'font-mono',
                factor.contribution >= 0 ? 'text-green-600' : 'text-red-600',
              ]"
            >
              {{ formatContribution(factor.contribution) }}
            </span>
          </div>
          <div class="mt-3 border-t border-gray-200 pt-3 flex justify-between text-sm font-semibold">
            <span>Total Score</span>
            <span class="font-mono">{{ Math.round(explanation.totalScore) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
