// Supabase Realtime composable for live data subscriptions

import {
  createClient,
  type RealtimeChannel,
  type RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { onUnmounted, type Ref, ref } from "vue";

// Initialize Supabase client (read-only via publishable key)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase && supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey, {
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }
  return supabase;
}

type ChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface SubscriptionOptions<T> {
  table: string;
  schema?: string;
  event?: ChangeEvent;
  filter?: string;
  onInsert?: (payload: T) => void;
  onUpdate?: (payload: { old: T; new: T }) => void;
  onDelete?: (payload: T) => void;
  onChange?: (payload: RealtimePostgresChangesPayload<T>) => void;
}

/**
 * Subscribe to realtime changes on a Supabase table
 * Returns cleanup function and connection state
 */
export function useSupabaseRealtime<T extends Record<string, unknown>>(
  options: SubscriptionOptions<T>,
) {
  const isConnected = ref(false);
  const error = ref<Error | null>(null);
  let channel: RealtimeChannel | null = null;

  const client = getSupabase();

  function subscribe() {
    if (!client) {
      error.value = new Error("Supabase not configured");
      return;
    }

    const channelName = `${options.schema || "todos"}_${options.table}_changes`;

    channel = client.channel(channelName);

    // Build filter configuration
    const filterConfig: {
      event: ChangeEvent;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event: options.event || "*",
      schema: options.schema || "todos",
      table: options.table,
    };

    if (options.filter) {
      filterConfig.filter = options.filter;
    }

    channel
      .on(
        "postgres_changes",
        filterConfig,
        (payload: RealtimePostgresChangesPayload<T>) => {
          // Call specific handlers
          if (payload.eventType === "INSERT" && options.onInsert) {
            options.onInsert(payload.new as T);
          } else if (payload.eventType === "UPDATE" && options.onUpdate) {
            options.onUpdate({
              old: payload.old as T,
              new: payload.new as T,
            });
          } else if (payload.eventType === "DELETE" && options.onDelete) {
            options.onDelete(payload.old as T);
          }

          // Call generic handler
          if (options.onChange) {
            options.onChange(payload);
          }
        },
      )
      .subscribe((status) => {
        isConnected.value = status === "SUBSCRIBED";
        if (status === "CHANNEL_ERROR") {
          error.value = new Error("Failed to subscribe to channel");
        }
      });
  }

  function unsubscribe() {
    if (channel && client) {
      client.removeChannel(channel);
      channel = null;
      isConnected.value = false;
    }
  }

  // Auto-subscribe on mount
  subscribe();

  // Cleanup on unmount
  onUnmounted(() => {
    unsubscribe();
  });

  return {
    isConnected,
    error,
    unsubscribe,
    resubscribe: () => {
      unsubscribe();
      subscribe();
    },
  };
}

/**
 * Subscribe to task changes
 */
export function useTaskRealtime(callbacks: {
  onInsert?: (task: Record<string, unknown>) => void;
  onUpdate?: (payload: {
    old: Record<string, unknown>;
    new: Record<string, unknown>;
  }) => void;
  onDelete?: (task: Record<string, unknown>) => void;
}) {
  return useSupabaseRealtime({
    table: "tasks",
    ...callbacks,
  });
}

/**
 * Subscribe to project changes
 */
export function useProjectRealtime(callbacks: {
  onInsert?: (project: Record<string, unknown>) => void;
  onUpdate?: (payload: {
    old: Record<string, unknown>;
    new: Record<string, unknown>;
  }) => void;
  onDelete?: (project: Record<string, unknown>) => void;
}) {
  return useSupabaseRealtime({
    table: "projects",
    ...callbacks,
  });
}

/**
 * Generic list syncing with realtime updates
 * Keeps a reactive list in sync with database changes
 */
export function useSyncedList<T extends { id: string }>(
  initialFetch: () => Promise<T[]>,
  table: string,
) {
  const items = ref<T[]>([]) as Ref<T[]>;
  const loading = ref(true);
  const fetchError = ref<Error | null>(null);

  // Initial fetch
  async function refresh() {
    loading.value = true;
    try {
      items.value = await initialFetch();
      fetchError.value = null;
    } catch (err) {
      fetchError.value = err as Error;
    } finally {
      loading.value = false;
    }
  }

  // Subscribe to realtime updates
  const { isConnected, error: realtimeError } = useSupabaseRealtime<
    T & Record<string, unknown>
  >({
    table,
    onInsert: (item) => {
      // Add new item if not already present
      const exists = items.value.some((i: T) => i.id === item.id);
      if (!exists) {
        items.value = [item as T, ...items.value];
      }
    },
    onUpdate: ({ new: updated }) => {
      // Update existing item
      const index = items.value.findIndex((i: T) => i.id === updated.id);
      if (index !== -1) {
        items.value[index] = updated as T;
      }
    },
    onDelete: (deleted) => {
      // Remove deleted item
      items.value = items.value.filter((i: T) => i.id !== deleted.id);
    },
  });

  // Initial load
  refresh();

  return {
    items,
    loading,
    error: fetchError,
    isConnected,
    realtimeError,
    refresh,
  };
}
