"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Send,
  Check,
  X,
  RotateCcw,
  Trash2,
  Twitter,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { TWEET_MAX_CHARS } from "@/lib/tweets/types";
import type { TweetDraft } from "@/lib/tweets/types";

const STATUS_LABEL: Record<string, string> = {
  pending_approval: "Pending review",
  approved: "Approved (will post at scheduled time)",
  posted: "Posted",
  rejected: "Rejected",
  failed: "Failed",
  expired: "Expired",
};

interface Props {
  initialDraft: TweetDraft;
}

export function TweetEditor({ initialDraft }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<TweetDraft>(initialDraft);
  const [content, setContent] = useState(initialDraft.content);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = content !== draft.content;
  const overLimit = content.length > TWEET_MAX_CHARS;
  const canEdit =
    draft.status === "pending_approval" ||
    draft.status === "approved" ||
    draft.status === "rejected";

  async function call(
    label: string,
    path: string,
    method: "POST" | "PATCH" | "DELETE",
    body?: unknown,
  ): Promise<{ ok: boolean; data: { draft?: TweetDraft; error?: string } }> {
    setBusy(label);
    setError(null);
    try {
      const resp = await fetch(path, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await resp.json().catch(() => ({}))) as {
        draft?: TweetDraft;
        error?: string;
      };
      if (!resp.ok) {
        setError(data.error ?? `${label} failed`);
        return { ok: false, data };
      }
      if (data.draft) {
        setDraft(data.draft);
        setContent(data.draft.content);
      }
      return { ok: true, data };
    } finally {
      setBusy(null);
    }
  }

  async function saveContent() {
    await call("Saving", `/api/v1/admin/tweets/${draft.id}`, "PATCH", { content });
  }

  async function approve(postNow = false) {
    if (dirty) await saveContent();
    await call(
      postNow ? "Posting" : "Approving",
      `/api/v1/admin/tweets/${draft.id}/approve`,
      "POST",
      { post_now: postNow },
    );
  }

  async function reject() {
    const reason = window.prompt("Rejection reason (optional):") ?? undefined;
    await call("Rejecting", `/api/v1/admin/tweets/${draft.id}/reject`, "POST", { reason });
  }

  async function regenerate() {
    if (
      !window.confirm(
        "Generate a new draft for this slot? The current content will be replaced.",
      )
    ) {
      return;
    }
    await call("Regenerating", `/api/v1/admin/tweets/${draft.id}/regenerate`, "POST", {});
  }

  async function remove() {
    if (!window.confirm("Delete this draft permanently?")) return;
    const result = await call("Deleting", `/api/v1/admin/tweets/${draft.id}`, "DELETE");
    if (result.ok) router.push("/admin/tweets");
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/tweets">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" /> Back to queue
          </Button>
        </Link>
        <Badge variant="outline" className="text-xs">
          {STATUS_LABEL[draft.status] ?? draft.status}
        </Badge>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Tweet content</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={6}
          className="font-mono text-sm"
          disabled={!canEdit || busy !== null}
        />
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            Theme: <span className="font-medium">{draft.theme}</span> · Scheduled:{" "}
            <span className="font-medium">
              {new Date(draft.scheduled_for).toLocaleString()}
            </span>
          </span>
          <span className={overLimit ? "text-red-500 font-semibold" : "text-muted-foreground"}>
            {content.length}/{TWEET_MAX_CHARS}
          </span>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {draft.failure_reason ? (
        <div className="rounded-md border border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300">
          <strong>Last failure:</strong> {draft.failure_reason}
        </div>
      ) : null}

      {draft.twitter_post_url ? (
        <a
          href={draft.twitter_post_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
        >
          <Twitter className="size-4" /> View live post on X
        </a>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {canEdit ? (
          <>
            <Button onClick={() => approve(false)} disabled={overLimit || busy !== null}>
              <Check className="size-4 mr-1.5" />
              Approve for scheduled time
            </Button>
            <Button
              variant="secondary"
              onClick={() => approve(true)}
              disabled={overLimit || busy !== null}
            >
              <Send className="size-4 mr-1.5" />
              Approve and post now
            </Button>
            <Button variant="outline" onClick={saveContent} disabled={!dirty || overLimit || busy !== null}>
              Save edits
            </Button>
            <Button variant="outline" onClick={regenerate} disabled={busy !== null}>
              <RotateCcw className="size-4 mr-1.5" />
              Regenerate
            </Button>
            <Button variant="outline" onClick={reject} disabled={busy !== null}>
              <X className="size-4 mr-1.5" />
              Reject
            </Button>
          </>
        ) : null}
        <Button variant="ghost" onClick={remove} disabled={busy !== null}>
          <Trash2 className="size-4 mr-1.5" />
          Delete
        </Button>
      </div>

      <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
        <div>Generated by: {String(draft.generation_metadata?.model ?? "unknown")}</div>
        <div>Created: {new Date(draft.created_at).toLocaleString()}</div>
        {draft.edited_at ? (
          <div>Edited: {new Date(draft.edited_at).toLocaleString()}</div>
        ) : null}
        {draft.approved_at ? (
          <div>Approved: {new Date(draft.approved_at).toLocaleString()}</div>
        ) : null}
        {draft.posted_at ? (
          <div>Posted: {new Date(draft.posted_at).toLocaleString()}</div>
        ) : null}
      </div>
    </div>
  );
}
