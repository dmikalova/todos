// Keyboard shortcuts composable
// Implements Gmail-style multi-key shortcuts (e.g., "g n" for go to next)

import { onUnmounted, ref } from "vue";

export interface Shortcut {
  keys: string;
  callback: () => void;
  description: string;
}

// Alias for backwards compatibility
export type ShortcutInfo = Shortcut;

// Global state for shortcuts
const shortcuts = ref<Map<string, Shortcut>>(new Map());
const keyBuffer = ref<string[]>([]);
const bufferTimeout = ref<number | null>(null);

// Buffer timeout in ms - how long to wait for second key
const BUFFER_TIMEOUT = 500;

// Key normalization
function normalizeKey(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey && e.key.length > 1) parts.push("Shift");

  // Normalize key names
  let key = e.key;
  if (key === " ") key = "Space";
  if (key.length === 1) key = key.toLowerCase();

  parts.push(key);
  return parts.join("+");
}

// Global key handler
function handleKeyDown(e: KeyboardEvent): void {
  // Ignore if typing in an input field
  const target = e.target as HTMLElement;
  if (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.isContentEditable
  ) {
    return;
  }

  const key = normalizeKey(e);

  // Clear existing timeout
  if (bufferTimeout.value) {
    clearTimeout(bufferTimeout.value);
    bufferTimeout.value = null;
  }

  // Add key to buffer
  keyBuffer.value.push(key);
  const combo = keyBuffer.value.join(" ");

  // Check for exact match
  const shortcut = shortcuts.value.get(combo);
  if (shortcut) {
    e.preventDefault();
    keyBuffer.value = [];
    shortcut.callback();
    return;
  }

  // Check if any shortcut starts with current buffer
  const hasPrefix = Array.from(shortcuts.value.keys()).some((k: string) =>
    k.startsWith(combo + " ")
  );

  if (hasPrefix) {
    // Wait for more keys
    bufferTimeout.value = setTimeout(() => {
      keyBuffer.value = [];
    }, BUFFER_TIMEOUT) as unknown as number;
  } else {
    // No match possible, clear buffer
    keyBuffer.value = [];
  }
}

// Initialize global listener (singleton)
let listenerInitialized = false;

function initListener(): void {
  if (listenerInitialized) return;
  listenerInitialized = true;
  document.addEventListener("keydown", handleKeyDown);
}

export function useKeyboardShortcuts() {
  initListener();

  const localShortcuts = ref<string[]>([]);

  function registerShortcut(
    keys: string,
    callback: () => void,
    description: string,
  ): void {
    shortcuts.value.set(keys, { keys, callback, description });
    localShortcuts.value.push(keys);
  }

  function unregisterShortcut(keys: string): void {
    shortcuts.value.delete(keys);
    const index = localShortcuts.value.indexOf(keys);
    if (index > -1) {
      localShortcuts.value.splice(index, 1);
    }
  }

  function unregisterAll(): void {
    for (const keys of localShortcuts.value) {
      shortcuts.value.delete(keys);
    }
    localShortcuts.value = [];
  }

  function getAllShortcuts(): Shortcut[] {
    return Array.from(shortcuts.value.values());
  }

  // Cleanup on component unmount
  onUnmounted(() => {
    unregisterAll();
  });

  return {
    registerShortcut,
    unregisterShortcut,
    unregisterAll,
    getAllShortcuts,
  };
}

// Standalone exports for use outside composable
// Initialize listener on first use
function ensureInitialized(): void {
  if (!listenerInitialized) {
    listenerInitialized = true;
    document.addEventListener("keydown", handleKeyDown);
  }
}

export function registerShortcut(
  keys: string,
  callback: () => void,
  description: string,
): void {
  ensureInitialized();
  shortcuts.value.set(keys, { keys, callback, description });
}

export function unregisterShortcut(keys: string): void {
  shortcuts.value.delete(keys);
}

export function getAllShortcuts(): Shortcut[] {
  return Array.from(shortcuts.value.values());
}
