"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Generic Supabase Realtime Subscription Hook
// ---------------------------------------------------------------------------
// Shares a single Supabase channel per table+filter combination so that
// multiple components subscribing to the same postgres_changes stream all
// receive every event.  Without this, Supabase may deduplicate and only
// deliver events to one of several channels with identical subscriptions.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";

type PostgresChangeEvent = "INSERT" | "UPDATE" | "DELETE";

interface UseRealtimeOptions<T> {
  table: string;
  schema?: string;
  filter?: string; // e.g., "org_id=eq.xxx"
  event?: PostgresChangeEvent | "*";
  onInsert?: (record: T) => void;
  onUpdate?: (record: T, oldRecord: T) => void;
  onDelete?: (oldRecord: T) => void;
  enabled?: boolean;
}

// ---- Shared channel registry ------------------------------------------------
// One Supabase channel per unique (schema, table, filter, event) tuple.
// Multiple hook instances register callbacks; the channel is torn down only
// when the last consumer unmounts.

interface CallbackEntry {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onInsert?: (record: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate?: (record: any, oldRecord: any) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDelete?: (oldRecord: any) => void;
}

interface ChannelEntry {
  channel: RealtimeChannel;
  refCount: number;
  callbacks: Map<symbol, CallbackEntry>;
}

const channelRegistry = new Map<string, ChannelEntry>();

function registryKey(opts: { schema?: string; table: string; filter?: string; event?: string }) {
  return `${opts.schema || "public"}:${opts.table}:${opts.filter || ""}:${opts.event || "*"}`;
}

// -----------------------------------------------------------------------------

/**
 * Subscribe to Supabase Realtime Postgres changes for a given table.
 *
 * When multiple components subscribe with the same table/filter/event, they
 * share a single underlying Supabase channel.  Each component's callbacks are
 * invoked independently so all consumers stay in sync.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRealtime<T extends { [key: string]: any }>(
  options: UseRealtimeOptions<T>,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Store callbacks in refs so the shared handler always calls the latest
  // version without needing to re-register.
  const onInsertRef = useRef(options.onInsert);
  const onUpdateRef = useRef(options.onUpdate);
  const onDeleteRef = useRef(options.onDelete);
  onInsertRef.current = options.onInsert;
  onUpdateRef.current = options.onUpdate;
  onDeleteRef.current = options.onDelete;

  // Stable identity for this hook instance across re-renders.
  const idRef = useRef<symbol | null>(null);
  if (!idRef.current) idRef.current = Symbol();

  useEffect(() => {
    if (options.enabled === false) return;

    const key = registryKey(options);
    const id = idRef.current!;

    // Callback entry that always delegates to the latest refs.
    const callbackEntry: CallbackEntry = {
      onInsert: (record) => onInsertRef.current?.(record),
      onUpdate: (record, old) => onUpdateRef.current?.(record, old),
      onDelete: (old) => onDeleteRef.current?.(old),
    };

    let entry = channelRegistry.get(key);

    if (entry) {
      // Reuse existing channel. Just register our callbacks.
      entry.refCount++;
      entry.callbacks.set(id, callbackEntry);
      channelRef.current = entry.channel;
    } else {
      // First subscriber. Create the channel.
      const supabase = createClient();
      const channelName = `realtime-${options.table}-${Math.random().toString(36).slice(2)}`;
      const channel = supabase.channel(channelName);

      entry = {
        channel,
        refCount: 1,
        callbacks: new Map([[id, callbackEntry]]),
      };
      channelRegistry.set(key, entry);

      channel.on(
        "postgres_changes",
        {
          event: options.event || "*",
          schema: options.schema || "public",
          table: options.table,
          filter: options.filter,
        },
        (payload: RealtimePostgresChangesPayload<T>) => {
          const current = channelRegistry.get(key);
          if (!current) return;

          for (const cb of current.callbacks.values()) {
            if (payload.eventType === "INSERT") {
              cb.onInsert?.(payload.new as T);
            } else if (payload.eventType === "UPDATE") {
              cb.onUpdate?.(payload.new as T, payload.old as T);
            } else if (payload.eventType === "DELETE") {
              cb.onDelete?.(payload.old as T);
            }
          }
        },
      );

      let retryCount = 0;
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          retryCount = 0;
          console.debug(`[Realtime] subscribed to ${options.table}${options.filter ? ` (${options.filter})` : ""}`);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          if (retryCount < 3) {
            retryCount++;
            const delay = 5000 * retryCount;
            console.warn(`[Realtime] ${status} for ${options.table}, retry ${retryCount}/3 in ${delay / 1000}s`);
            setTimeout(() => {
              const current = channelRegistry.get(key);
              if (current && current.channel === channel) {
                channel.subscribe();
              }
            }, delay);
          } else {
            console.error(`[Realtime] failed to subscribe to ${options.table} after 3 retries`);
          }
        }
      });

      channelRef.current = channel;
    }

    return () => {
      const current = channelRegistry.get(key);
      if (!current) return;

      current.callbacks.delete(id);
      current.refCount--;

      if (current.refCount <= 0) {
        // Last consumer. Tear down the channel.
        const supabase = createClient();
        supabase.removeChannel(current.channel);
        channelRegistry.delete(key);
        channelRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.table, options.filter, options.enabled, options.schema, options.event]);

  return channelRef;
}
