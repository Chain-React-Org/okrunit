"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Bell,
  Clock,
  CheckCircle2,
  XCircle,
  Inbox,
  Loader2,
  ArrowRight,
  Users,
  UserPlus,
  Workflow,
  Sparkles,
  CheckCheck,
  MessageSquare,
  Unplug,
  ShieldAlert,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useRealtime } from "@/hooks/use-realtime";
import { toast } from "sonner";
import type { InAppNotification, NotificationCategory } from "@/lib/types/database";

interface NotificationPanelProps {
  pendingCount?: number;
  userId?: string;
}

const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: typeof Bell; color: string }
> = {
  approval_awaiting: { icon: Clock, color: "text-amber-500" },
  approval_created: { icon: Inbox, color: "text-blue-400" },
  approval_decided: { icon: CheckCircle2, color: "text-emerald-500" },
  approval_comment: { icon: MessageSquare, color: "text-blue-500" },
  flow_step_decided: { icon: Workflow, color: "text-blue-500" },
  approval_expiring: { icon: Clock, color: "text-red-500" },
  team_invite: { icon: UserPlus, color: "text-violet-500" },
  team_added: { icon: Users, color: "text-indigo-500" },
  flow_assigned: { icon: Workflow, color: "text-cyan-500" },
  welcome: { icon: Sparkles, color: "text-primary" },
  connection_deactivated: { icon: Unplug, color: "text-red-500" },
  role_changed: { icon: ShieldAlert, color: "text-amber-500" },
  limit_approaching: { icon: AlertTriangle, color: "text-amber-500" },
  billing: { icon: CreditCard, color: "text-emerald-500" },
};

function getNotificationHref(n: InAppNotification): string {
  if (n.resource_type === "approval_request" && n.resource_id) {
    return `/requests?open=${n.resource_id}`;
  }
  if (n.resource_type === "team" && n.resource_id) {
    return `/org/teams/${n.resource_id}`;
  }
  if (n.resource_type === "org_invite") {
    return "/org/members";
  }
  return "/requests";
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function NotificationPanel({ userId }: NotificationPanelProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  // Realtime callbacks. Declared before useRealtime to keep hook order stable
  const handleRealtimeInsert = useCallback((record: InAppNotification) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.id === record.id)) return prev;
      return [record, ...prev].slice(0, 20);
    });
    if (!record.is_read) {
      setUnreadCount((prev) => prev + 1);
      toast(record.category === "approval_awaiting" ? "New request needs your approval" : record.title, {
        description: record.body || undefined,
        action: record.resource_type === "approval_request" && record.resource_id
          ? { label: "View", onClick: () => { window.location.href = `/requests?open=${record.resource_id}`; } }
          : undefined,
      });
    }
    // Notify other components (e.g. requests page auto-marks as read)
    window.dispatchEvent(new Event("notification-received"));
  }, []);

  const handleRealtimeUpdate = useCallback((record: InAppNotification) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === record.id ? record : n));
      setUnreadCount(updated.filter((n) => !n.is_read).length);
      return updated;
    });
  }, []);

  const handleRealtimeDelete = useCallback((oldRecord: InAppNotification) => {
    setNotifications((prev) => prev.filter((n) => n.id !== oldRecord.id));
    if (!oldRecord.is_read) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  }, []);

  // Realtime: listen for new, updated, and deleted notifications
  useRealtime<InAppNotification>({
    table: "in_app_notifications",
    filter: userId ? `user_id=eq.${userId}` : undefined,
    enabled: !!userId,
    onInsert: handleRealtimeInsert,
    onUpdate: handleRealtimeUpdate,
    onDelete: handleRealtimeDelete,
  });

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notifications/activity?limit=20");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
        setUnreadCount(data.unreadCount ?? 0);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, []);

  // Prefetch notifications on mount so badge count is accurate and data is ready
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Refresh when panel is reopened
  useEffect(() => {
    if (open && fetched) {
      fetchNotifications();
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic refetch: stay fresh even if Supabase Realtime drops
  useEffect(() => {
    if (!userId) return;

    const refetch = () => {
      if (document.visibilityState === "visible") fetchNotifications();
    };

    const interval = setInterval(refetch, 30000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") refetch();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [userId, fetchNotifications]);

  async function handleMarkAllRead() {
    try {
      await fetch("/api/v1/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })),
      );
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }

  async function handleMarkRead(id: string) {
    try {
      await fetch("/api/v1/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }

  const badgeCount = unreadCount;

  // Mark all unread as read when the panel closes
  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen && unreadCount > 0) {
      // Clear badge immediately, then fire API in background
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() })),
      );
      fetch("/api/v1/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      }).catch(() => {});
    }
    setOpen(nextOpen);
  }, [unreadCount]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClearAll() {
    try {
      await fetch("/api/v1/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clear: true }),
      });
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // Silently fail
    }
  }

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8 text-muted-foreground hover:text-foreground"
          aria-label={
            badgeCount > 0
              ? `Notifications (${badgeCount} unread)`
              : "Notifications"
          }
        >
          <Bell className="size-[18px]" />
          {badgeCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-[18px] items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white ring-2 ring-background">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[380px] p-0"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Content - scroll isolated from page */}
        <div className="max-h-[420px] overflow-y-auto overscroll-contain">
          {loading && !fetched ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <div className="rounded-xl bg-muted p-3">
                <Inbox className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">
                All caught up
              </p>
              <p className="px-8 text-xs text-muted-foreground">
                You&rsquo;ll be notified here when approval requests need your
                attention, decisions are made, or you&rsquo;re added to a team.
              </p>
            </div>
          ) : (
            <div>
              {notifications.map((n) => (
                <NotificationRow
                  key={n.id}
                  notification={n}
                  onNavigate={() => {
                    if (!n.is_read) handleMarkRead(n.id);
                    setOpen(false);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="flex items-center justify-between border-t px-4 py-2.5">
            <button
              onClick={handleClearAll}
              className="text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
            >
              Clear all
            </button>
            <Link
              href="/requests"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              View all requests
              <ArrowRight className="size-3" />
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NotificationRow({
  notification: n,
  onNavigate,
}: {
  notification: InAppNotification;
  onNavigate: () => void;
}) {
  const config = CATEGORY_CONFIG[n.category] ?? {
    icon: Bell,
    color: "text-muted-foreground",
  };
  const Icon = config.icon;

  // Override icon for rejected decisions
  const isRejected =
    n.category === "approval_decided" && n.title.includes("rejected");
  const DisplayIcon = isRejected ? XCircle : Icon;
  const iconColor = isRejected ? "text-red-500" : config.color;

  // Parse body for pills. Only match the structured format: "Medium priority · from Zapier"
  const structuredMatch = n.body?.match(/^(\w+)\s+priority(?:\s+·\s+from\s+(\w+))?$/i);
  const priorityLabel = structuredMatch?.[1];
  const sourceRaw = structuredMatch?.[2];
  const sourceName = sourceRaw ? sourceRaw.charAt(0).toUpperCase() + sourceRaw.slice(1) : undefined;
  const sourceKey = sourceRaw?.toLowerCase();

  const priorityColors: Record<string, string> = {
    critical: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400",
    medium: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
    low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  };

  // Show a friendlier title for awaiting notifications
  const displayTitle = n.category === "approval_awaiting"
    ? n.title.replace(/^New request:\s*/, "")
    : n.title;
  const isAwaiting = n.category === "approval_awaiting";

  return (
    <Link
      href={getNotificationHref(n)}
      onClick={onNavigate}
      className={cn(
        "flex items-start gap-3 px-4 py-3 transition-colors border-b border-border/30 last:border-b-0 hover:bg-accent",
        n.is_read
          ? "bg-muted/50 dark:bg-muted/20"
          : "bg-white dark:bg-card",
      )}
    >
      {/* Icon */}
      <DisplayIcon className={cn("size-4 shrink-0 self-center", iconColor)} />

      {/* Content */}
      <div className="min-w-0 flex-1">
        {isAwaiting && (
          <p className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mb-0.5">
            Needs your approval
          </p>
        )}
        <p className="text-sm leading-tight font-medium text-foreground">
          {displayTitle}
        </p>

        {/* Pills row */}
        {(sourceName || priorityLabel) && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {sourceName && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {sourceKey && (
                  <img
                    src={`/logos/platforms/${sourceKey}.png`}
                    alt=""
                    className="size-3 rounded"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                {sourceName}
              </span>
            )}
            {priorityLabel && (
              <span className={cn(
                "rounded-full px-2 py-0.5 text-[11px] font-medium",
                priorityColors[priorityLabel.toLowerCase()] ?? "bg-muted text-muted-foreground"
              )}>
                {priorityLabel}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground/60">
              {timeAgo(n.created_at)}
            </span>
          </div>
        )}

        {/* Fallback: show body text and time if no pills parsed */}
        {!sourceName && !priorityLabel && (
          <>
            {n.body && (() => {
              // Try to insert a platform logo before "from SourceName"
              const fromMatch = n.body.match(/from\s+([A-Z]\w+)/);
              const bodySourceName = fromMatch?.[1];
              const bodySourceKey = bodySourceName?.toLowerCase();

              if (bodySourceName && bodySourceKey) {
                const idx = n.body.indexOf(`from ${bodySourceName}`);
                const before = n.body.slice(0, idx + 5); // "...from "
                const after = n.body.slice(idx + 5 + bodySourceName.length);
                const capitalized = before.charAt(0).toUpperCase() + before.slice(1);
                return (
                  <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                    {capitalized}
                    <img
                      src={`/logos/platforms/${bodySourceKey}.png`}
                      alt=""
                      className="size-3.5 rounded inline-block align-text-bottom mx-0.5"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    {bodySourceName}{after}
                  </p>
                );
              }

              return (
                <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
                  {n.body.charAt(0).toUpperCase() + n.body.slice(1)}
                </p>
              );
            })()}
            <p className="mt-1 text-[11px] text-muted-foreground/70">
              {timeAgo(n.created_at)}
            </p>
          </>
        )}
      </div>
    </Link>
  );
}
