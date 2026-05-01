"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  RefreshCw,
  Sparkles,
  Twitter,
  Clock,
  CheckCircle,
  AlertTriangle,
  Settings,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TweetDraft, TweetDraftStatus } from "@/lib/tweets/types";

const STATUS_LABEL: Record<TweetDraftStatus, string> = {
  pending_approval: "Pending",
  approved: "Approved",
  posted: "Posted",
  rejected: "Rejected",
  failed: "Failed",
  expired: "Expired",
};

const STATUS_BADGE: Record<TweetDraftStatus, string> = {
  pending_approval: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  posted: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300",
  rejected: "bg-muted text-muted-foreground",
  failed: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
  expired: "bg-muted text-muted-foreground",
};

const THEME_LABEL: Record<string, string> = {
  feature: "Feature",
  lesson: "Lesson",
  use_case: "Use case",
  milestone: "Milestone",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface Stats {
  pending: number;
  approved: number;
  posted: number;
}

export function TweetsQueue() {
  const [drafts, setDrafts] = useState<TweetDraft[]>([]);
  const [stats, setStats] = useState<Stats>({ pending: 0, approved: 0, posted: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TweetDraftStatus | "all">("pending_approval");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      const resp = await fetch(`/api/v1/admin/tweets?${params.toString()}`);
      const data = (await resp.json()) as {
        drafts: TweetDraft[];
        stats: Stats;
      };
      setDrafts(data.drafts ?? []);
      setStats(data.stats ?? { pending: 0, approved: 0, posted: 0 });
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function generateNow() {
    setGenerating(true);
    try {
      const resp = await fetch("/api/v1/admin/tweets/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify: true }),
      });
      if (resp.ok) {
        await load();
      }
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Twitter className="size-6" /> Tweet Automation
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI-generated drafts, approved by you, posted to X on a schedule.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/tweets/brief">
            <Button variant="outline" size="sm">
              <FileText className="size-4 mr-2" /> Brief
            </Button>
          </Link>
          <Link href="/admin/tweets/config">
            <Button variant="outline" size="sm">
              <Settings className="size-4 mr-2" /> Config
            </Button>
          </Link>
          <Button onClick={generateNow} disabled={generating} size="sm">
            <Sparkles className={`size-4 mr-2 ${generating ? "animate-pulse" : ""}`} />
            Generate now
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Pending" value={stats.pending} icon={Clock} tone="amber" />
        <StatCard label="Approved" value={stats.approved} icon={CheckCircle} tone="emerald" />
        <StatCard label="Posted" value={stats.posted} icon={Twitter} tone="blue" />
      </div>

      <div className="flex items-center justify-between">
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as TweetDraftStatus | "all")}>
          <TabsList>
            <TabsTrigger value="pending_approval">Pending</TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="posted">Posted</TabsTrigger>
            <TabsTrigger value="failed">Failed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="rounded-lg border">
        {loading && drafts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : drafts.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No drafts in this view yet.
          </div>
        ) : (
          <ul className="divide-y">
            {drafts.map((d) => (
              <li key={d.id} className="p-4 hover:bg-muted/30">
                <Link href={`/admin/tweets/${d.id}`} className="block">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-2">
                      <Badge className={STATUS_BADGE[d.status]}>
                        {STATUS_LABEL[d.status]}
                      </Badge>
                      <Badge variant="outline">{THEME_LABEL[d.theme] ?? d.theme}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(d.scheduled_for)}
                      </span>
                    </div>
                    <span className={`text-xs ${d.content.length > 280 ? "text-red-500" : "text-muted-foreground"}`}>
                      {d.content.length}/280
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{d.content}</p>
                  {d.failure_reason ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-red-500">
                      <AlertTriangle className="size-3" /> {d.failure_reason}
                    </div>
                  ) : null}
                  {d.twitter_post_url ? (
                    <a
                      href={d.twitter_post_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-xs text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on X
                    </a>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Twitter;
  tone: "amber" | "emerald" | "blue";
}) {
  const toneClasses: Record<string, string> = {
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    blue: "text-blue-600 dark:text-blue-400",
  };
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className={`size-4 ${toneClasses[tone]}`} />
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

