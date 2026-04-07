"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Bug,
  CheckCircle,
  Copy,
  EyeOff,
  RotateCcw,
  Clock,
  TrendingUp,
  Users,
  GitCommit,
  Globe,
  User2,
  Building2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ErrorIssue, ErrorEvent, ErrorSeverity } from "@/lib/monitoring/types";

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
  return `${days}d ago`;
}

const SEVERITY_STYLES: Record<ErrorSeverity, string> = {
  fatal: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  error: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400",
};

const BREADCRUMB_ICONS: Record<string, typeof Bug> = {
  api: Globe,
  auth: User2,
  db: Building2,
  navigation: Globe,
  error: Bug,
};

interface ErrorDetailViewProps {
  issueId: string;
}

export function ErrorDetailView({ issueId }: ErrorDetailViewProps) {
  const [issue, setIssue] = useState<ErrorIssue | null>(null);
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/admin/errors/${issueId}`);
        if (res.ok) {
          const data = await res.json();
          setIssue(data.issue);
          setEvents(data.events);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [issueId]);

  async function handleStatusChange(newStatus: string) {
    setUpdating(true);
    try {
      const res = await fetch(`/api/v1/admin/errors/${issueId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setIssue(data.issue);
      }
    } catch {
      // Silently fail
    } finally {
      setUpdating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!issue) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Bug className="size-8 text-muted-foreground/30 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Error not found</p>
      </div>
    );
  }

  const latestEvent = events[0];

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <div>
        <Link
          href="/admin/errors"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="size-3" />
          Back to errors
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={cn("text-xs", SEVERITY_STYLES[issue.severity])}>
                {issue.severity}
              </Badge>
              <Badge variant="secondary" className="text-xs capitalize">
                {issue.status}
              </Badge>
              {issue.service && (
                <Badge variant="outline" className="text-xs">
                  {issue.service}
                </Badge>
              )}
            </div>
            <h1 className="text-lg font-semibold break-all">{issue.title}</h1>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {issue.status !== "resolved" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 bg-white dark:bg-card"
                onClick={() => handleStatusChange("resolved")}
                disabled={updating}
              >
                <CheckCircle className="size-3.5 text-emerald-500" />
                Resolve
              </Button>
            )}
            {issue.status !== "ignored" && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 bg-white dark:bg-card"
                onClick={() => handleStatusChange("ignored")}
                disabled={updating}
              >
                <EyeOff className="size-3.5 text-muted-foreground" />
                Ignore
              </Button>
            )}
            {(issue.status === "resolved" || issue.status === "ignored") && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 bg-white dark:bg-card"
                onClick={() => handleStatusChange("unresolved")}
                disabled={updating}
              >
                <RotateCcw className="size-3.5 text-amber-500" />
                Reopen
              </Button>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="size-3" />
            {issue.event_count} events
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {issue.affected_users} users affected
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            First seen {timeAgo(issue.first_seen_at)}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            Last seen {timeAgo(issue.last_seen_at)}
          </span>
          {issue.first_release && (
            <span className="flex items-center gap-1">
              <GitCommit className="size-3" />
              {issue.first_release.slice(0, 7)}
            </span>
          )}
        </div>
      </div>

      {/* Copy for AI - single block with all context for pasting to Claude */}
      {latestEvent && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Copy for AI</CardTitle>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5 bg-white dark:bg-card"
                onClick={() => {
                  const pathname = latestEvent.request_url
                    ? (() => { try { return new URL(latestEvent.request_url).pathname; } catch { return latestEvent.request_url; } })()
                    : null;
                  const segments = pathname?.split("/").filter(Boolean) ?? [];
                  const likelyFiles = pathname
                    ? [
                        `src/app/(dashboard)/${segments.join("/")}/page.tsx`,
                        `src/app/(auth)/${segments.join("/")}/page.tsx`,
                        `src/app/${segments.join("/")}/page.tsx`,
                      ].map(f => `- ${f}`).join("\n")
                    : "Unknown";

                  const text = [
                    `Fix this error in our Next.js app:`,
                    ``,
                    `**Error:** ${issue.title}`,
                    `**Severity:** ${issue.severity}`,
                    `**Service:** ${latestEvent.service ?? "Unknown"}`,
                    `**Page/URL:** ${pathname ?? "Unknown"}`,
                    `**Occurrences:** ${issue.event_count}`,
                    `**Users affected:** ${issue.affected_users}`,
                    `**First seen:** ${new Date(issue.first_seen_at).toLocaleString()}`,
                    latestEvent.environment ? `**Environment:** ${latestEvent.environment}` : null,
                    issue.first_release ? `**Release:** ${issue.first_release.slice(0, 7)}` : null,
                    ``,
                    `**Likely source files:**`,
                    likelyFiles,
                    ``,
                    latestEvent.stack_trace ? `**Stack trace:**\n\`\`\`\n${latestEvent.stack_trace}\n\`\`\`` : null,
                    ``,
                    latestEvent.breadcrumbs && latestEvent.breadcrumbs.length > 0
                      ? `**Breadcrumbs (actions before crash):**\n${latestEvent.breadcrumbs.map(b => `- [${b.type}/${b.category}] ${b.message}`).join("\n")}`
                      : null,
                    ``,
                    latestEvent.context && Object.keys(latestEvent.context).length > 0
                      ? `**Context:**\n\`\`\`json\n${JSON.stringify(latestEvent.context, null, 2)}\n\`\`\``
                      : null,
                  ].filter(Boolean).join("\n");

                  navigator.clipboard.writeText(text).then(() => {
                    toast.success("Copied error report to clipboard");
                  });
                }}
              >
                <Copy className="size-3" />
                Copy to clipboard
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              One-click copy of this error with all context. Paste directly into Claude or any AI assistant to get a fix.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Likely source files - maps URL path to Next.js file conventions */}
      {latestEvent?.request_url && (() => {
        try {
          const pathname = new URL(latestEvent.request_url).pathname;
          const segments = pathname.split("/").filter(Boolean);
          const possiblePaths = [
            `src/app/(dashboard)/${segments.join("/")}/page.tsx`,
            `src/app/(auth)/${segments.join("/")}/page.tsx`,
            `src/app/${segments.join("/")}/page.tsx`,
          ];
          return (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Likely Source Files</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground mb-2">
                  Based on route <code className="rounded bg-muted px-1.5 py-0.5">{pathname}</code>, check these files:
                </p>
                <ul className="space-y-1">
                  {possiblePaths.map((p) => (
                    <li key={p} className="text-xs font-mono text-foreground">{p}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        } catch { return null; }
      })()}

      {/* Stack trace */}
      {latestEvent?.stack_trace && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Stack Trace</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap break-all">
              {latestEvent.stack_trace}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Breadcrumbs */}
      {latestEvent?.breadcrumbs && latestEvent.breadcrumbs.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Breadcrumbs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {latestEvent.breadcrumbs.map((crumb, i) => {
                const Icon = BREADCRUMB_ICONS[crumb.type] ?? Bug;
                return (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <Icon className="size-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {crumb.category}
                        </Badge>
                        <span className="text-muted-foreground">
                          {new Date(crumb.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-foreground mt-0.5">{crumb.message}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Context */}
      {latestEvent?.context && Object.keys(latestEvent.context).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Context</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-relaxed font-mono">
              {JSON.stringify(latestEvent.context, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {issue.tags && Object.keys(issue.tags).length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(issue.tags).map(([key, value]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  {key}: {value}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Events */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Events ({events.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-xs text-muted-foreground">No events recorded.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2 text-xs"
                >
                  <Badge className={cn("text-[10px] shrink-0", SEVERITY_STYLES[event.severity])}>
                    {event.severity}
                  </Badge>
                  <span className="truncate flex-1 text-muted-foreground">
                    {event.message}
                  </span>
                  {event.user_id && (
                    <span className="shrink-0 flex items-center gap-1 text-muted-foreground">
                      <User2 className="size-3" />
                      {event.user_id.slice(0, 8)}...
                    </span>
                  )}
                  {event.request_url && (
                    <span className="shrink-0 text-muted-foreground hidden sm:block">
                      {new URL(event.request_url).pathname}
                    </span>
                  )}
                  <span className="shrink-0 text-muted-foreground">
                    {timeAgo(event.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
