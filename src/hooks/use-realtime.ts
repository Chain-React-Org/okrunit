"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Generic Supabase Realtime Subscription Hook
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

/**
 * Subscribe to Supabase Realtime Postgres changes for a given table.
 *
 * The subscription is scoped by an optional RLS-compatible `filter` string
 * (e.g. `org_id=eq.<uuid>`) and automatically cleaned up on unmount or when
 * the `table`, `filter`, or `enabled` dependencies change.
 *
 * Returns a ref to the underlying `RealtimeChannel` for advanced use-cases.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useRealtime<T extends { [key: string]: any }>(
  options: UseRealtimeOptions<T>,
) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Store callbacks in refs so the channel handler always calls the latest
  // version without needing to re-subscribe when callbacks change.
  const onInsertRef = useRef(options.onInsert);
  const onUpdateRef = useRef(options.onUpdate);
  const onDeleteRef = useRef(options.onDelete);
  onInsertRef.current = options.onInsert;
  onUpdateRef.current = options.onUpdate;
  onDeleteRef.current = options.onDelete;

  useEffect(() => {
    if (options.enabled === false) return;

    let cancelled = false;
    const supabase = createClient();
    const channelName = `realtime-${options.table}-${Math.random().toString(36).slice(2)}`;

    const channel = supabase.channel(channelName);

    channel.on(
      "postgres_changes",
      {
        event: options.event || "*",
        schema: options.schema || "public",
        table: options.table,
        filter: options.filter,
      },
      (payload: RealtimePostgresChangesPayload<T>) => {
        if (cancelled) return;
        if (payload.eventType === "INSERT" && onInsertRef.current) {
          onInsertRef.current(payload.new as T);
        } else if (payload.eventType === "UPDATE" && onUpdateRef.current) {
          onUpdateRef.current(payload.new as T, payload.old as T);
        } else if (payload.eventType === "DELETE" && onDeleteRef.current) {
          onDeleteRef.current(payload.old as T);
        }
      },
    );

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.debug(`[Realtime] subscribed to ${options.table}${options.filter ? ` (${options.filter})` : ""}`);
      } else if (status === "CHANNEL_ERROR") {
        console.error(`[Realtime] channel error for ${options.table}`);
      } else if (status === "TIMED_OUT") {
        console.warn(`[Realtime] subscription timed out for ${options.table}`);
      }
    });
    channelRef.current = channel;

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.table, options.filter, options.enabled]);

  return channelRef;
}
