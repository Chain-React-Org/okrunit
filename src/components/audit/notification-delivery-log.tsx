"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Notification Delivery Log
// Displays a filterable, paginated table of notification delivery events.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  FileText,
  Globe,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;
const ALL_VALUE = "__all__";

interface ChannelMeta {
  label: string;
  icon: LucideIcon;
}

const CHANNELS: Record<string, ChannelMeta> = {
  email: { label: "Email", icon: Mail },
  slack: { label: "Slack", icon: MessageSquare },
  discord: { label: "Discord", icon: MessageCircle },
  teams: { label: "Teams", icon: Globe },
  telegram: { label: "Telegram", icon: Send },
  sms: { label: "SMS", icon: Phone },
  web_push: { label: "Web Push", icon: Bell },
  webhook: { label: "Webhook", icon: Webhook },
};

type DeliveryStatus = "sent" | "failed" | "suppressed";

function statusBadgeClasses(status: DeliveryStatus): string {
  switch (status) {
    case "sent":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400";
    case "failed":
      return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
    case "suppressed":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400";
    default:
      return "";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeliveryLogEntry {
  id: string;
  created_at: string;
  request_id: string;
  request_title: string;
  recipient: string;
  channel: string;
  status: DeliveryStatus;
  error_message: string | null;
  suppression_reason: string | null;
}

interface NotificationDeliveryLogProps {
  orgId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationDeliveryLog({ orgId }: NotificationDeliveryLogProps) {
  const [entries, setEntries] = useState<DeliveryLogEntry[] | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);
  const [hasMore, setHasMore] = useState(false);
  const [isPending, startTransition] = useTransition();

  const fetchEntries = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
      if (channelFilter !== ALL_VALUE) params.set("channel", channelFilter);
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(`/api/v1/notifications/delivery-log?${params.toString()}`);
      if (!res.ok) return { data: [], has_more: false };
      return res.json() as Promise<{ data: DeliveryLogEntry[]; has_more: boolean }>;
    },
    [channelFilter, statusFilter],
  );

  // Initial load and reload on filter change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await fetchEntries();
      if (cancelled) return;
      setEntries(result.data);
      setHasMore(result.has_more);
    };
    setEntries(null);
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchEntries]);

  const loadMore = useCallback(() => {
    if (!entries || entries.length === 0) return;
    const lastEntry = entries[entries.length - 1];
    startTransition(async () => {
      const result = await fetchEntries(lastEntry.id);
      setEntries((prev) => [...(prev ?? []), ...result.data]);
      setHasMore(result.has_more);
    });
  }, [entries, fetchEntries]);

  const hasActiveFilters = channelFilter !== ALL_VALUE || statusFilter !== ALL_VALUE;

  const clearFilters = useCallback(() => {
    setChannelFilter(ALL_VALUE);
    setStatusFilter(ALL_VALUE);
  }, []);

  // Loading skeleton
  if (entries === null) {
    return (
      <div className="space-y-4 pt-4">
        <div className="flex gap-3">
          <Skeleton className="h-9 w-[200px]" />
          <Skeleton className="h-9 w-[200px]" />
        </div>
        <div className="rounded-xl border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-4 w-[140px]" />
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-5 w-[70px] rounded-full" />
              <Skeleton className="h-5 w-[60px] rounded-full" />
              <Skeleton className="h-4 w-[160px]" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-white dark:bg-card text-foreground">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All channels</SelectItem>
            {Object.entries(CHANNELS).map(([key, meta]) => (
              <SelectItem key={key} value={key}>
                {meta.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px] bg-white dark:bg-card text-foreground">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All statuses</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="suppressed">Suppressed</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        )}

        <div className="ml-auto">
          <span className="text-muted-foreground text-sm">
            {entries.length} entries
          </span>
        </div>
      </div>

      {/* Table */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 rounded-xl border-0 py-20 text-center shadow-[var(--shadow-card)]">
          <div className="empty-state-icon rounded-2xl p-5">
            <Bell className="size-9 text-muted-foreground/70" />
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold text-foreground">
              No notification deliveries found
            </p>
            {hasActiveFilters ? (
              <p className="text-sm text-muted-foreground">
                Try adjusting your filters to see more results.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Notification delivery events will appear here as approvals are processed.
              </p>
            )}
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Request</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const channelMeta = CHANNELS[entry.channel];
                const ChannelIcon = channelMeta?.icon ?? Globe;
                const channelLabel = channelMeta?.label ?? entry.channel;

                let details = "";
                if (entry.status === "failed" && entry.error_message) {
                  details = entry.error_message;
                } else if (entry.status === "suppressed" && entry.suppression_reason) {
                  details = entry.suppression_reason;
                }

                return (
                  <TableRow key={entry.id}>
                    <TableCell
                      className="text-muted-foreground text-xs"
                      title={new Date(entry.created_at).toLocaleString()}
                    >
                      {formatDistanceToNow(new Date(entry.created_at), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell
                      className="max-w-[200px] truncate text-sm"
                      title={entry.request_title}
                    >
                      {entry.request_title}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[160px] truncate text-xs">
                      {entry.recipient}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <ChannelIcon className="size-3.5 text-muted-foreground" />
                        {channelLabel}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusBadgeClasses(entry.status)}
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[240px] truncate text-xs">
                      {details || "-"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            onClick={loadMore}
            disabled={isPending}
            className="bg-white dark:bg-card text-foreground hover:bg-muted"
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
