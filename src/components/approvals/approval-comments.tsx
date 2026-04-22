"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Approval Comments: Threaded Comment List + Reply Form
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect, memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Send, Trash2, CheckCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

import type { ApprovalComment, UserProfile } from "@/lib/types/database";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { UserName } from "@/components/approvals/user-name";

// ---- Types ----------------------------------------------------------------

interface ApprovalCommentsProps {
  requestId: string;
  comments: ApprovalComment[];
  onCommentAdded: (comment: ApprovalComment) => void;
  onCommentDeleted?: (commentId: string) => void;
  userProfiles?: Map<string, UserProfile>;
  connectionNames?: Map<string, string>;
  currentUserId?: string;
  currentUserRole?: string;
}

// ---- Helpers --------------------------------------------------------------

const SOURCE_LABELS: Record<string, string> = {
  zapier: "Zapier",
  make: "Make",
  "make.com": "Make",
  n8n: "n8n",
  api: "API",
  dashboard: "User",
};

const SOURCE_LOGOS: Record<string, string> = {
  zapier: "/logos/platforms/zapier.png",
  make: "/logos/platforms/make.png",
  "make.com": "/logos/platforms/make.png",
  n8n: "/logos/platforms/n8n.png",
  slack: "/logos/platforms/slack.png",
  discord: "/logos/platforms/discord.png",
  teams: "/logos/platforms/teams.png",
  telegram: "/logos/platforms/telegram.png",
  github: "/logos/platforms/github.png",
  monday: "/logos/platforms/monday.png",
  pipedream: "/logos/platforms/pipedream.png",
};

function getAuthorName(
  comment: ApprovalComment,
  userProfiles?: Map<string, UserProfile>,
  connectionNames?: Map<string, string>,
): string {
  if (comment.source && comment.source !== "dashboard" && comment.source !== "api") {
    return SOURCE_LABELS[comment.source] ?? comment.source;
  }
  if (comment.user_id) {
    const profile = userProfiles?.get(comment.user_id);
    if (profile?.full_name) return profile.full_name;
    if (profile?.email) return profile.email;
    return comment.user_id.slice(0, 8) + "…";
  }
  if (comment.connection_id) {
    const name = connectionNames?.get(comment.connection_id);
    if (name) return name;
    return "API (" + comment.connection_id.slice(0, 8) + ")";
  }
  return "Unknown";
}

function getAvatarInitials(
  comment: ApprovalComment,
  userProfiles?: Map<string, UserProfile>,
): string {
  if (comment.source && comment.source !== "dashboard" && comment.source !== "api") {
    return comment.source[0].toUpperCase();
  }
  if (comment.user_id) {
    const profile = userProfiles?.get(comment.user_id);
    if (profile?.full_name) {
      const parts = profile.full_name.split(" ");
      return parts.length > 1
        ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
        : parts[0][0].toUpperCase();
    }
    return "U";
  }
  if (comment.connection_id) return "A";
  return "?";
}

function getSourceBadge(comment: ApprovalComment): { label: string; variant: "secondary" | "outline" } {
  if (comment.source && comment.source !== "dashboard" && comment.source !== "api") {
    return { label: "App", variant: "outline" };
  }
  if (comment.user_id) return { label: "User", variant: "secondary" };
  return { label: "API", variant: "outline" };
}

// ---- Component ------------------------------------------------------------

export const ApprovalComments = memo(function ApprovalComments({
  requestId,
  comments,
  onCommentAdded,
  onCommentDeleted,
  userProfiles,
  connectionNames,
  currentUserId,
  currentUserRole,
}: ApprovalCommentsProps) {
  const [body, setBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Array<{ id: string; user_id: string; vote: string; comment: string | null; created_at: string }>>([]);

  const isAdmin = currentUserRole === "owner" || currentUserRole === "admin";

  // Fetch votes for this request
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("approval_votes")
      .select("id, user_id, vote, comment, created_at")
      .eq("request_id", requestId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setVotes(data); });
  }, [requestId]);

  // Subscribe to realtime INSERT events for this request's comments
  const handleRealtimeInsert = useCallback(
    (record: ApprovalComment) => {
      onCommentAdded(record);
    },
    [onCommentAdded],
  );

  useRealtime<ApprovalComment>({
    table: "approval_comments",
    filter: `request_id=eq.${requestId}`,
    event: "INSERT",
    onInsert: handleRealtimeInsert,
  });

  // ---- Submit handler -----------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmed = body.trim();
    if (!trimmed) return;

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/v1/approvals/${requestId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed }),
        },
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to post comment");
      }

      setBody("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to post comment",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---- Delete handler (optimistic) -----------------------------------------

  function handleConfirmDelete() {
    if (!confirmDeleteId) return;
    const commentId = confirmDeleteId;
    setConfirmDeleteId(null);

    // Optimistic: remove immediately
    onCommentDeleted?.(commentId);
    toast.success("Comment deleted");

    // Background: send delete request
    fetch(
      `/api/v1/approvals/${requestId}/comments?comment_id=${commentId}`,
      { method: "DELETE" },
    ).then((res) => {
      if (!res.ok) {
        toast.error("Failed to delete comment on server");
      }
    }).catch(() => {
      toast.error("Failed to delete comment");
    });
  }

  // ---- Render -------------------------------------------------------------

  return (
    <div className="space-y-3">
      {/* Reply form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Textarea
          placeholder="Write a comment..."
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          disabled={isSubmitting}
          className="resize-none text-sm min-h-[36px]"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (body.trim()) handleSubmit(e);
            }
          }}
        />
        <Button
          type="submit"
          size="sm"
          className="shrink-0 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
          disabled={isSubmitting || !body.trim()}
        >
          <Send className="size-3.5" />
        </Button>
      </form>

      {/* Activity timeline: comments + votes interleaved chronologically */}
      {comments.length === 0 && votes.length === 0 ? (
        <p className="text-muted-foreground text-xs">No activity yet.</p>
      ) : (
        <div className="space-y-3">
          {/* Render votes as system entries */}
          {(() => {
            // Merge comments and votes into a single timeline
            type TimelineItem = { type: "comment"; data: ApprovalComment; at: number } | { type: "vote"; data: typeof votes[number]; at: number };
            const timeline: TimelineItem[] = [
              ...comments.map((c) => ({ type: "comment" as const, data: c, at: new Date(c.created_at).getTime() })),
              ...votes.map((v) => ({ type: "vote" as const, data: v, at: new Date(v.created_at).getTime() })),
            ].sort((a, b) => a.at - b.at);

            return timeline.map((item) => {
              if (item.type === "vote") {
                const v = item.data;
                const isApprove = v.vote === "approve";
                return (
                  <div key={`vote-${v.id}`} className="flex items-center gap-2 px-1 py-1.5 rounded-lg bg-muted/30">
                    {isApprove
                      ? <CheckCircle className="size-3.5 shrink-0 text-emerald-500" />
                      : <XCircle className="size-3.5 shrink-0 text-red-500" />
                    }
                    <span className="text-xs text-muted-foreground">
                      <UserName
                        userId={v.user_id}
                        userProfiles={userProfiles}
                        className="font-medium text-foreground"
                      />
                      {" "}{isApprove ? "approved" : "rejected"}
                      {v.comment && <span className="italic"> · &ldquo;{v.comment}&rdquo;</span>}
                    </span>
                    <span className="text-muted-foreground/60 text-[10px] ml-auto shrink-0">
                      {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}
                    </span>
                  </div>
                );
              }

              // Comment rendering (existing)
              const comment = item.data;
            const canDelete = isAdmin || comment.user_id === currentUserId;
            const badge = getSourceBadge(comment);

            return (
              <div key={comment.id} className="group/comment flex items-center gap-2.5">
                <div className="flex flex-1 min-w-0 gap-2.5">
                  <Avatar className="size-7 shrink-0 mt-0.5">
                    {comment.source && SOURCE_LOGOS[comment.source] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <AvatarImage src={SOURCE_LOGOS[comment.source]} alt={SOURCE_LABELS[comment.source] ?? comment.source} />
                    )}
                    <AvatarFallback className="text-[10px]">
                      {getAvatarInitials(comment, userProfiles)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold">
                        {comment.user_id && (!comment.source || comment.source === "dashboard" || comment.source === "api") ? (
                          <UserName userId={comment.user_id} userProfiles={userProfiles} />
                        ) : (
                          getAuthorName(comment, userProfiles, connectionNames)
                        )}
                      </span>
                      <Badge
                        variant={badge.variant}
                        className="text-[9px] px-1 py-0 shrink-0"
                      >
                        {badge.label}
                      </Badge>
                      <span className="text-muted-foreground text-[10px] shrink-0">
                        {formatDistanceToNow(new Date(comment.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>

                    <p className="text-sm whitespace-pre-wrap break-words mt-0.5 leading-relaxed">
                      {comment.body}
                    </p>
                  </div>
                </div>

                {canDelete && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setConfirmDeleteId(comment.id)}
                        className="opacity-0 group-hover/comment:opacity-100 transition-opacity shrink-0 p-1 rounded text-muted-foreground/40 hover:text-destructive cursor-pointer"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top">Delete comment</TooltipContent>
                  </Tooltip>
                )}
              </div>
            );
            });
          })()}
        </div>
      )}
      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete comment</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>This will permanently delete this comment. This action cannot be undone.</p>
                {(() => {
                  const target = comments.find((c) => c.id === confirmDeleteId);
                  if (!target) return null;
                  const targetBadge = getSourceBadge(target);
                  return (
                    <div className="rounded-lg border bg-muted/30 px-3 py-2.5">
                      <div className="flex gap-2.5">
                        <Avatar className="size-7 shrink-0 mt-0.5">
                          {target.source && SOURCE_LOGOS[target.source] && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <AvatarImage src={SOURCE_LOGOS[target.source]} alt={SOURCE_LABELS[target.source] ?? target.source} />
                          )}
                          <AvatarFallback className="text-[10px]">
                            {getAvatarInitials(target, userProfiles)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold truncate text-foreground">
                              {getAuthorName(target, userProfiles, connectionNames)}
                            </span>
                            <Badge variant={targetBadge.variant} className="text-[9px] px-1 py-0 shrink-0">
                              {targetBadge.label}
                            </Badge>
                            <span className="text-muted-foreground text-[10px] shrink-0">
                              {formatDistanceToNow(new Date(target.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap break-words mt-0.5 leading-relaxed text-foreground">
                            {target.body}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="!bg-emerald-600 !text-white hover:!bg-emerald-700 cursor-pointer"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
