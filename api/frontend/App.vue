<script setup lang="ts">
import { onMounted, onUnmounted, ref } from "vue";
import { useRouter } from "vue-router";
import ErrorToast from "./components/ErrorToast.vue";
import KeyboardShortcutsDialog from "./components/KeyboardShortcutsDialog.vue";
import NavBar from "./components/NavBar.vue";
import { useKeyboardShortcuts } from "./composables/useKeyboardShortcuts.ts";

const router = useRouter();
const showShortcuts = ref(false);

// Global keyboard shortcuts
const { registerShortcut, unregisterAll } = useKeyboardShortcuts();

onMounted(() => {
  // Navigation shortcuts
  registerShortcut("g n", () => router.push("/"), "Go to Next");
  registerShortcut("g t", () => router.push("/tasks"), "Go to Tasks");
  registerShortcut("g p", () => router.push("/projects"), "Go to Projects");
  registerShortcut("g h", () => router.push("/history"), "Go to History");
  registerShortcut("g s", () => router.push("/settings"), "Go to Settings");

  // Help shortcut
  registerShortcut("?", () => (showShortcuts.value = true), "Show shortcuts");
  registerShortcut("Escape", () => (showShortcuts.value = false), "Close dialog");
});

onUnmounted(() => {
  unregisterAll();
});
</script>

<template>
  <div class="min-h-full">
    <!-- Navigation -->
    <NavBar />

    <!-- Main content -->
    <main class="py-6">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <router-view v-slot="{ Component }">
          <transition
            name="fade"
            mode="out-in"
            enter-active-class="transition-opacity duration-150"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-150"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>

    <!-- Global error toast -->
    <ErrorToast />

    <!-- Keyboard shortcuts help dialog -->
    <KeyboardShortcutsDialog
      :open="showShortcuts"
      @close="showShortcuts = false"
    />
  </div>
</template>
