"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Notification Delivery Log
// Displays a filterable, paginated table of notification delivery events.
// ---------------------------------------------------------------------------

import { Fragment, useCallback, useEffect, useState, useTransition, memo } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  ChevronDown,
  ChevronRight,
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

/** Convert snake_case keys to readable labels */
function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\bid\b/gi, "ID")
    .replace(/\bip\b/gi, "IP")
    .replace(/\burl\b/gi, "URL")
    .replace(/^./, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(formatValue).join(", ");
  return JSON.stringify(value);
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
  external_id: string | null;
  metadata: Record<string, unknown>;
}

interface NotificationDeliveryLogProps {
  orgId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const NotificationDeliveryLog = memo(function NotificationDeliveryLog({ orgId }: NotificationDeliveryLogProps) {
  const [entries, setEntries] = useState<DeliveryLogEntry[] | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>(ALL_VALUE);
  const [statusFilter, setStatusFilter] = useState<string>(ALL_VALUE);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const fetchEntries = useCallback(
    async (pg: number) => {
      const params = new URLSearchParams({
        page: String(pg),
        per_page: String(PAGE_SIZE),
      });
      if (channelFilter !== ALL_VALUE) params.set("channel", channelFilter);
      if (statusFilter !== ALL_VALUE) params.set("status", statusFilter);

      const res = await fetch(`/api/v1/notifications/delivery-log?${params.toString()}`);
      if (!res.ok) return { entries: [] as DeliveryLogEntry[], hasMore: false };
      const json = await res.json() as {
        entries: DeliveryLogEntry[];
        pagination: { page: number; total_pages: number };
      };
      return {
        entries: json.entries,
        hasMore: json.pagination.page < json.pagination.total_pages,
      };
    },
    [channelFilter, statusFilter],
  );

  // Initial load and reload on filter change
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const result = await fetchEntries(1);
      if (cancelled) return;
      setEntries(result.entries);
      setHasMore(result.hasMore);
      setPage(1);
      setExpandedRows(new Set());
    };
    setEntries(null);
    load();
    return () => {
      cancelled = true;
    };
  }, [fetchEntries]);

  const loadMore = useCallback(() => {
    if (!entries || entries.length === 0) return;
    const nextPage = page + 1;
    startTransition(async () => {
      const result = await fetchEntries(nextPage);
      setEntries((prev) => [...(prev ?? []), ...result.entries]);
      setHasMore(result.hasMore);
      setPage(nextPage);
    });
  }, [entries, page, fetchEntries]);

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
    <div className="space-y-4 pt-4" data-tour="notification-delivery-log">
      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center" data-tour="ndl-filters">
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
                <TableHead className="w-8" />
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
                const isExpanded = expandedRows.has(entry.id);

                let summaryDetail = "";
                if (entry.status === "failed" && entry.error_message) {
                  summaryDetail = entry.error_message;
                } else if (entry.status === "suppressed" && entry.suppression_reason) {
                  summaryDetail = entry.suppression_reason;
                }

                const hasExpandableDetails =
                  (entry.metadata && Object.keys(entry.metadata).length > 0) ||
                  entry.external_id ||
                  entry.error_message ||
                  entry.suppression_reason;

                return (
                  <Fragment key={entry.id}>
                    <TableRow>
                      <TableCell>
                        {hasExpandableDetails ? (
                          <button
                            type="button"
                            onClick={() => toggleRow(entry.id)}
                            className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors"
                            aria-label={isExpanded ? "Collapse details" : "Expand details"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronRight className="size-4" />
                            )}
                          </button>
                        ) : null}
                      </TableCell>
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
                        {summaryDetail || "-"}
                      </TableCell>
                    </TableRow>

                    {/* Expanded details row */}
                    {isExpanded && hasExpandableDetails && (
                      <TableRow key={`details-${entry.id}`}>
                        <TableCell colSpan={7} className="bg-muted/30 p-0">
                          <div className="px-6 py-4 space-y-3">
                            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                              Delivery Details
                            </p>
                            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                              {entry.request_id && (
                                <>
                                  <span className="text-muted-foreground font-medium">Request ID</span>
                                  <span className="text-foreground font-mono">{entry.request_id}</span>
                                </>
                              )}
                              {entry.external_id && (
                                <>
                                  <span className="text-muted-foreground font-medium">External ID</span>
                                  <span className="text-foreground font-mono">{entry.external_id}</span>
                                </>
                              )}
                              {entry.error_message && (
                                <>
                                  <span className="text-muted-foreground font-medium">Error</span>
                                  <span className="text-red-600 dark:text-red-400">{entry.error_message}</span>
                                </>
                              )}
                              {entry.suppression_reason && (
                                <>
                                  <span className="text-muted-foreground font-medium">Suppression Reason</span>
                                  <span className="text-yellow-600 dark:text-yellow-400">{entry.suppression_reason}</span>
                                </>
                              )}
                              {entry.metadata && Object.entries(entry.metadata).map(([key, value]) => (
                                <Fragment key={key}>
                                  <span className="text-muted-foreground font-medium">{formatKey(key)}</span>
                                  <span className="text-foreground break-all">{formatValue(value)}</span>
                                </Fragment>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
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
});
