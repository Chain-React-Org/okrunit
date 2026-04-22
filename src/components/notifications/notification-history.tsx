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
  Users,
  UserPlus,
  Workflow,
  Sparkles,
  MessageSquare,
  CheckCheck,
  Filter,
  Unplug,
  ShieldAlert,
  AlertTriangle,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InAppNotification, NotificationCategory } from "@/lib/types/database";

const CATEGORY_CONFIG: Record<
  NotificationCategory,
  { icon: typeof Bell; color: string; label: string }
> = {
  approval_awaiting: { icon: Clock, color: "text-amber-500", label: "Awaiting" },
  approval_created: { icon: Inbox, color: "text-blue-400", label: "New Request" },
  approval_decided: { icon: CheckCircle2, color: "text-emerald-500", label: "Decided" },
  approval_comment: { icon: MessageSquare, color: "text-blue-500", label: "Comment" },
  flow_step_decided: { icon: Workflow, color: "text-blue-500", label: "Flow Step" },
  approval_expiring: { icon: Clock, color: "text-red-500", label: "Expiring" },
  team_invite: { icon: UserPlus, color: "text-violet-500", label: "Invite" },
  team_added: { icon: Users, color: "text-indigo-500", label: "Team" },
  flow_assigned: { icon: Workflow, color: "text-cyan-500", label: "Flow" },
  welcome: { icon: Sparkles, color: "text-primary", label: "Welcome" },
  connection_deactivated: { icon: Unplug, color: "text-red-500", label: "Connection" },
  role_changed: { icon: ShieldAlert, color: "text-amber-500", label: "Permissions" },
  limit_approaching: { icon: AlertTriangle, color: "text-amber-500", label: "Limit" },
  billing: { icon: CreditCard, color: "text-emerald-500", label: "Billing" },
  delegation_received: { icon: UserPlus, color: "text-emerald-500", label: "Delegation" },
};

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

function getNotificationHref(n: InAppNotification): string {
  if (n.resource_type === "approval_request" && n.resource_id) {
    return `/requests?highlight=${n.resource_id}`;
  }
  if (n.resource_type === "team" && n.resource_id) {
    return `/org/teams/${n.resource_id}`;
  }
  return "/requests";
}

export function NotificationHistory() {
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (filter === "unread") params.set("unread", "true");
      const res = await fetch(`/api/v1/notifications/activity?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications ?? []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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
    } catch {
      // Silently fail
    }
  }

  const filtered = filter === "all"
    ? notifications
    : filter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications.filter((n) => n.category === filter);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary mb-0.5">Settings</p>
          <h1 className="text-xl font-semibold tracking-tight">Notification History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[150px] h-8 text-xs bg-white dark:bg-card">
              <Filter className="size-3 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="approval_awaiting">Awaiting</SelectItem>
              <SelectItem value="approval_decided">Decided</SelectItem>
              <SelectItem value="approval_expiring">Expiring</SelectItem>
              <SelectItem value="team_invite">Invites</SelectItem>
            </SelectContent>
          </Select>
          {unreadCount > 0 && (
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleMarkAllRead}>
              <CheckCheck className="size-3" />
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-16 text-center">
          <Inbox className="size-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No notifications</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {filter !== "all" ? "Try changing your filter" : "Notifications will appear here as events happen"}
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {filtered.map((n) => {
            const config = CATEGORY_CONFIG[n.category] ?? { icon: Bell, color: "text-muted-foreground", label: n.category };
            const Icon = config.icon;
            const isRejected = n.category === "approval_decided" && n.title.includes("rejected");
            const DisplayIcon = isRejected ? XCircle : Icon;
            const iconColor = isRejected ? "text-red-500" : config.color;

            return (
              <Link
                key={n.id}
                href={getNotificationHref(n)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3 transition-colors hover:border-border",
                  !n.is_read && "border-l-2 border-l-primary",
                )}
              >
                <DisplayIcon className={cn("size-4 mt-0.5 shrink-0", iconColor)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={cn("text-sm", !n.is_read ? "font-medium" : "text-muted-foreground")}>
                      {n.title}
                    </p>
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {config.label}
                    </Badge>
                  </div>
                  {n.body && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground/60 mt-1">{timeAgo(n.created_at)}</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
