<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api";

// State
const loading = ref(false);
const exportLoading = ref(false);
const importFile = ref<File | null>(null);
const importMode = ref<"merge" | "replace">("merge");
const importResult = ref<{ created: number; updated: number; skipped: number } | null>(null);

// Settings (would normally be persisted)
const settings = ref({
  defaultProject: null as string | null,
  defaultContext: null as string | null,
  showCompletedByDefault: false,
  keyboardShortcutsEnabled: true,
  theme: "light" as "light" | "dark" | "system",
});

// Data for dropdowns
const projects = ref<{ id: string; name: string }[]>([]);
const contexts = ref<{ id: string; name: string }[]>([]);

// Export handlers
async function exportAll(format: "json" | "csv") {
  exportLoading.value = true;
  try {
    const data = await api.dataExport.all(format);
    downloadFile(data, `todos-export.${format}`, format === "json" ? "application/json" : "text/csv");
  } finally {
    exportLoading.value = false;
  }
}

async function exportTasks(format: "json" | "csv") {
  exportLoading.value = true;
  try {
    const data = await api.dataExport.tasks(format);
    downloadFile(data, `todos-tasks.${format}`, format === "json" ? "application/json" : "text/csv");
  } finally {
    exportLoading.value = false;
  }
}

function downloadFile(data: unknown, filename: string, mimeType: string) {
  const content = mimeType === "application/json" ? JSON.stringify(data, null, 2) : String(data);
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import handlers
function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files.length > 0) {
    importFile.value = target.files[0];
  }
}

async function importData() {
  if (!importFile.value) return;

  loading.value = true;
  try {
    const text = await importFile.value.text();
    const data = JSON.parse(text);

    const result = await api.dataImport.all(data, importMode.value);
    importResult.value = result;
    importFile.value = null;

    // Reset file input
    const fileInput = document.getElementById("import-file") as HTMLInputElement;
    if (fileInput) fileInput.value = "";
  } catch (e) {
    throw e;
  } finally {
    loading.value = false;
  }
}

// Fetch data for settings
async function fetchSettingsData() {
  try {
    const [projectData, contextData] = await Promise.all([
      api.projects.list(),
      api.contexts.list(),
    ]);
    projects.value = projectData;
    contexts.value = contextData;
  } catch (e) {
    // Ignore errors loading settings data
  }
}

onMounted(() => {
  fetchSettingsData();
});
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8">
    <h1 class="mb-8 text-2xl font-bold text-gray-900">Settings</h1>

    <!-- Preferences Section -->
    <section class="mb-8">
      <h2 class="mb-4 text-lg font-medium text-gray-900">Preferences</h2>
      <div class="rounded-lg border border-gray-200 bg-white divide-y divide-gray-200">
        <!-- Default Project -->
        <div class="flex items-center justify-between p-4">
          <div>
            <h3 class="text-sm font-medium text-gray-900">Default Project</h3>
            <p class="text-sm text-gray-500">New tasks will be assigned to this project</p>
          </div>
          <select
            v-model="settings.defaultProject"
            class="rounded-md border-gray-300 text-sm focus:border-lime-500 focus:ring-lime-500"
          >
            <option :value="null">None (Inbox)</option>
            <option v-for="project in projects" :key="project.id" :value="project.id">
              {{ project.name }}
            </option>
          </select>
        </div>

        <!-- Show Completed -->
        <div class="flex items-center justify-between p-4">
          <div>
            <h3 class="text-sm font-medium text-gray-900">Show Completed Tasks</h3>
            <p class="text-sm text-gray-500">Display completed tasks by default in task list</p>
          </div>
          <input
            v-model="settings.showCompletedByDefault"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
          />
        </div>

        <!-- Keyboard Shortcuts -->
        <div class="flex items-center justify-between p-4">
          <div>
            <h3 class="text-sm font-medium text-gray-900">Keyboard Shortcuts</h3>
            <p class="text-sm text-gray-500">Enable Gmail-style keyboard navigation</p>
          </div>
          <input
            v-model="settings.keyboardShortcutsEnabled"
            type="checkbox"
            class="h-4 w-4 rounded border-gray-300 text-lime-600 focus:ring-lime-500"
          />
        </div>

        <!-- Theme -->
        <div class="flex items-center justify-between p-4">
          <div>
            <h3 class="text-sm font-medium text-gray-900">Theme</h3>
            <p class="text-sm text-gray-500">Choose your preferred appearance</p>
          </div>
          <select
            v-model="settings.theme"
            class="rounded-md border-gray-300 text-sm focus:border-lime-500 focus:ring-lime-500"
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>
    </section>

    <!-- Export Section -->
    <section class="mb-8">
      <h2 class="mb-4 text-lg font-medium text-gray-900">Export Data</h2>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="mb-4 text-sm text-gray-500">
          Download your data in JSON or CSV format for backup or migration.
        </p>
        <div class="flex flex-wrap gap-3">
          <button
            @click="exportAll('json')"
            :disabled="exportLoading"
            class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export All (JSON)
          </button>
          <button
            @click="exportTasks('csv')"
            :disabled="exportLoading"
            class="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Tasks (CSV)
          </button>
        </div>
      </div>
    </section>

    <!-- Import Section -->
    <section class="mb-8">
      <h2 class="mb-4 text-lg font-medium text-gray-900">Import Data</h2>
      <div class="rounded-lg border border-gray-200 bg-white p-4">
        <p class="mb-4 text-sm text-gray-500">
          Import data from a JSON backup file. Choose merge to add new items while keeping existing data, or replace to overwrite.
        </p>

        <div class="space-y-4">
          <div>
            <label for="import-file" class="block text-sm font-medium text-gray-700">
              Select file
            </label>
            <input
              id="import-file"
              type="file"
              accept=".json"
              @change="handleFileSelect"
              class="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-lime-50 file:text-lime-700 hover:file:bg-lime-100"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Import mode</label>
            <div class="flex gap-4">
              <label class="flex items-center">
                <input
                  v-model="importMode"
                  type="radio"
                  value="merge"
                  class="h-4 w-4 border-gray-300 text-lime-600 focus:ring-lime-500"
                />
                <span class="ml-2 text-sm text-gray-700">Merge (keep existing)</span>
              </label>
              <label class="flex items-center">
                <input
                  v-model="importMode"
                  type="radio"
                  value="replace"
                  class="h-4 w-4 border-gray-300 text-lime-600 focus:ring-lime-500"
                />
                <span class="ml-2 text-sm text-gray-700">Replace (overwrite)</span>
              </label>
            </div>
          </div>

          <button
            @click="importData"
            :disabled="!importFile || loading"
            class="inline-flex items-center gap-2 rounded-md bg-lime-600 px-4 py-2 text-sm font-semibold text-white hover:bg-lime-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg v-if="loading" class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </button>

          <!-- Import Result -->
          <div v-if="importResult" class="rounded-md bg-green-50 p-4">
            <div class="flex">
              <svg class="h-5 w-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-green-800">Import complete</h3>
                <p class="mt-1 text-sm text-green-700">
                  {{ importResult.created }} created, {{ importResult.updated }} updated, {{ importResult.skipped }} skipped
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Danger Zone -->
    <section>
      <h2 class="mb-4 text-lg font-medium text-red-900">Danger Zone</h2>
      <div class="rounded-lg border border-red-200 bg-red-50 p-4">
        <p class="mb-4 text-sm text-red-700">
          These actions are irreversible. Please export your data before proceeding.
        </p>
        <div class="flex flex-wrap gap-3">
          <button
            @click="() => { if (confirm('Delete all completed tasks? This cannot be undone.')) { /* TODO */ } }"
            class="inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete Completed Tasks
          </button>
          <button
            @click="() => { if (confirm('Delete ALL data? This cannot be undone.')) { /* TODO */ } }"
            class="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
          >
            Delete All Data
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
