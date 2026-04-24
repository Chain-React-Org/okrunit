"use client";

import { useEffect, useCallback, useState, memo } from "react";
import { useOnboardingTourStore } from "@/stores/onboarding-tour-store";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { sanitizeHtml } from "@/lib/sanitize";
import { PriorityBadge } from "@/components/approvals/priority-badge";
import { ApprovalResponseForm } from "@/components/approvals/approval-response-form";
import { ApprovalComments } from "@/components/approvals/approval-comments";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import { SourceAvatar } from "@/components/approvals/source-icons";
import { UserName } from "@/components/approvals/user-name";
import { canDecideOnApproval } from "@/lib/approvals/responsible";
import {
  Users,
  UserCheck,
  CheckCircle,
  Circle,
  ArrowRight,
  Settings2,
  MessageSquare,
  HelpCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ApprovalRequest, ApprovalComment, UserProfile, CreatedByInfo } from "@/lib/types/database";

interface ApprovalDetailProps {
  approval: ApprovalRequest | null;
  open: boolean;
  onClose: () => void;
  onRespond: (
    approvalId: string,
    decision: "approved" | "rejected",
    comment: string
  ) => void;
  isLoading: boolean;
  canApprove?: boolean;
  /** Org setting: creators may decide on their own requests when true.
   * Off by default (segregation of duties). */
  allowSelfApproval?: boolean;
  /** Whether the current user has the `can_manage_flows` permission in
   * this org. Controls whether the "Configure Flow Rules" button is
   * rendered. Server also enforces this on the flow PATCH and
   * reassign endpoints, so the button hiding is UX, not security. */
  canManageFlows?: boolean;
  userProfiles?: Map<string, UserProfile>;
  creatorName?: string;
  onConfigureFlow?: (approval: ApprovalRequest) => void;
  initialComments?: ApprovalComment[];
  onCommentsChange?: (approvalId: string, comments: ApprovalComment[]) => void;
  currentUserId?: string;
  currentUserRole?: string;
  /** IDs of users who have actively delegated their approval authority to
   * the current user. Used to let delegates see Approve/Reject when the
   * original approver is assigned. */
  delegatorIds?: ReadonlySet<string>;
  /** Pre-computed watch state for the opening approval so the Watch button
   * renders in the correct position immediately instead of flickering. */
  initialIsWatching?: boolean;
  /** Called when the user toggles the watch state so the parent can update
   * its cached watch map. */
  onWatchChange?: (approvalId: string, isWatching: boolean) => void;
}

const statusStyles: Record<string, { label: string; dot: string; badge: string }> = {
  pending: { label: "Pending", dot: "bg-amber-500", badge: "bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800" },
  approved: { label: "Approved", dot: "bg-emerald-500", badge: "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800" },
  rejected: { label: "Rejected", dot: "bg-red-500", badge: "bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800" },
  cancelled: { label: "Cancelled", dot: "bg-zinc-400", badge: "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" },
  expired: { label: "Expired", dot: "bg-zinc-400", badge: "bg-zinc-100 dark:bg-zinc-800/50 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700" },
};

/** Humanize an elapsed duration, e.g. "3h 15m" or "2d 5h". */
function formatDuration(fromIso: string, toIso: string): string {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!isFinite(ms) || ms < 0) return "";
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
  if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  if (minutes > 0) return `${minutes}m`;
  return `${totalSec}s`;
}

function getCreatedByDisplay(createdBy: CreatedByInfo): string {
  if (createdBy.connection_name) return createdBy.connection_name;
  if (createdBy.client_name) return createdBy.client_name;
  return createdBy.type === "api_key" ? "API Key" : "OAuth Client";
}

function LabelWithTip({ label, tip }: { label: string; tip: string }) {
  return (
    <div className="flex items-center gap-1 mb-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="size-3 text-muted-foreground/40 cursor-help shrink-0" />
        </TooltipTrigger>
        <TooltipContent side="top">{tip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export const ApprovalDetail = memo(function ApprovalDetail({
  approval,
  open,
  onClose,
  onRespond,
  isLoading,
  canApprove = true,
  allowSelfApproval = false,
  canManageFlows = false,
  userProfiles,
  creatorName,
  onConfigureFlow,
  initialComments,
  onCommentsChange,
  currentUserId,
  currentUserRole,
  delegatorIds,
  initialIsWatching = false,
  onWatchChange,
}: ApprovalDetailProps) {
  const tourActive = useOnboardingTourStore((s) => s.activePageId === "requests" && s.currentStepInPage === 4);
  const currentId = open && approval ? approval.id : null;

  // Watch state — seed from parent-supplied value so the button renders with
  // the correct label immediately when the panel opens.
  const [isWatching, setIsWatching] = useState(initialIsWatching);
  const [watcherCount, setWatcherCount] = useState(0);

  // Reseed when the opened approval changes (the prop is for the *new* id).
  useEffect(() => {
    setIsWatching(initialIsWatching);
  }, [currentId, initialIsWatching]);

  // Fetch the total watcher count (and reconcile isWatching as a safety net
  // if the cached prop is stale).
  useEffect(() => {
    if (!currentId) return;
    fetch(`/api/v1/approvals/${currentId}/watch`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data.isWatching === "boolean") setIsWatching(data.isWatching);
        setWatcherCount(data.count ?? 0);
      })
      .catch(() => {});
  }, [currentId]);

  const toggleWatch = useCallback(async () => {
    if (!currentId) return;
    const next = !isWatching;
    const method = next ? "POST" : "DELETE";
    // Optimistic update for snappy UX.
    setIsWatching(next);
    setWatcherCount((prev) => Math.max(0, prev + (next ? 1 : -1)));
    onWatchChange?.(currentId, next);

    const res = await fetch(`/api/v1/approvals/${currentId}/watch`, { method });
    if (!res.ok) {
      // Revert if the server rejected.
      setIsWatching(!next);
      setWatcherCount((prev) => Math.max(0, prev + (next ? -1 : 1)));
      onWatchChange?.(currentId, !next);
    }
  }, [currentId, isWatching, onWatchChange]);

  // Comments are owned by the parent dashboard via commentsMap.
  // This component just reads them and pushes changes up.
  const comments = initialComments ?? [];

  const setComments = (newComments: ApprovalComment[] | ((prev: ApprovalComment[]) => ApprovalComment[])) => {
    if (!currentId) return;
    const resolved = typeof newComments === "function" ? newComments(comments) : newComments;
    onCommentsChange?.(currentId, resolved);
  };

  // Keyboard shortcuts: a = approve, r = reject (only when detail is open and
  // the current user is the responsible approver — not a self-creator, not a
  // non-assigned viewer, not out-of-turn on a sequential chain).
  useEffect(() => {
    if (!open || !approval) return;
    if (!canDecideOnApproval(approval, currentUserId, !!canApprove, delegatorIds, allowSelfApproval)) return;

    function handleKey(e: KeyboardEvent) {
      // Don't fire if user is typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "a" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onRespond(approval!.id, "approved", "");
      } else if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onRespond(approval!.id, "rejected", "");
      }
    }

    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, approval, canApprove, allowSelfApproval, onRespond, currentUserId, delegatorIds]);

  // No local fetch needed. Comments are prefetched by the parent dashboard.

  const handleCommentAdded = useCallback((comment: ApprovalComment) => {
    if (!currentId) return;
    onCommentsChange?.(currentId, [...(initialComments ?? []).filter((c) => c.id !== comment.id), comment]);
  }, [currentId, initialComments, onCommentsChange]);

  if (!approval) return null;

  const status = statusStyles[approval.status] ?? statusStyles.pending;
  const hasMultiApproval = approval.required_approvals > 1 || (approval.is_sequential && approval.assigned_approvers && approval.assigned_approvers.length > 0);
  const hasAssignedApprovers = approval.assigned_approvers && approval.assigned_approvers.length > 0;
  const progressPct = approval.required_approvals > 0
    ? Math.round((approval.current_approvals / approval.required_approvals) * 100)
    : 0;
  const createdBy = approval.created_by as CreatedByInfo | null;

  // Whether the current user is the one the request is waiting on right now.
  const isResponsibleApprover = (() => {
    if (!currentUserId || approval.status !== "pending") return false;
    if (!hasAssignedApprovers) return true; // any-approver mode — org-level canApprove governs
    const eligible = new Set<string>([currentUserId]);
    if (delegatorIds) for (const id of delegatorIds) eligible.add(id);
    if (approval.is_sequential) {
      const nextUserId = approval.assigned_approvers![approval.current_approvals];
      return !!nextUserId && eligible.has(nextUserId);
    }
    return approval.assigned_approvers!.some((uid: string) => eligible.has(uid));
  })();

  // Block self-approval: the requester can't approve their own request.
  const isSelfCreated = !!createdBy?.user_id && createdBy.user_id === currentUserId;

  // True when the current user is explicitly listed on this request's
  // approver chain — used to tune the self-created explainer so we don't
  // tell them "another approver must decide" when they can see themselves
  // in the chain above.
  const isSelfAnAssignedApprover =
    !!currentUserId && hasAssignedApprovers && approval.assigned_approvers!.includes(currentUserId);

  // In a sequential chain, find the current user's slot and whether they've
  // already approved (slot index strictly before current_approvals). Used
  // to tell the difference between "waiting on you later" and "you already
  // did your part".
  const currentUserSequentialSlot =
    approval.is_sequential && isSelfAnAssignedApprover
      ? approval.assigned_approvers!.indexOf(currentUserId!)
      : -1;
  const userAlreadyApprovedSequential =
    currentUserSequentialSlot >= 0 &&
    currentUserSequentialSlot < approval.current_approvals;

  // Authoritative gate — shared with ApprovalCard so the inline and detail
  // buttons can never drift. Hides for self-created, non-assigned, and
  // non-next-in-line users. Delegates are treated as eligible on behalf of
  // their delegators.
  const effectiveCanApprove = canDecideOnApproval(approval, currentUserId, !!canApprove, delegatorIds, allowSelfApproval);

  // Names of approvers still pending a decision (parallel: everyone who hasn't
  // pushed current_approvals past their slot; sequential: the rest of the chain).
  const remainingApprovers = (() => {
    if (!hasAssignedApprovers) return [] as string[];
    if (approval.is_sequential) {
      return approval.assigned_approvers!.slice(approval.current_approvals);
    }
    // Parallel: we don't have the votes list here, so surface up to required-minus-received names.
    const pendingCount = Math.max(0, approval.required_approvals - approval.current_approvals);
    return approval.assigned_approvers!.slice(0, Math.min(pendingCount, approval.assigned_approvers!.length));
  })();

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()} modal={!tourActive}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col bg-card"
        data-tour="detail-panel"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-4 bg-card border-b border-border/50">
          <SheetTitle className="text-base font-semibold leading-snug">{approval.title}</SheetTitle>
          {approval.description && (
            <SheetDescription className="text-[13px] text-muted-foreground mt-1 leading-relaxed">
              {approval.description}
            </SheetDescription>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {/* Activity log notice - at the top */}
          {approval.is_log && (
            <div className="rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 p-4">
              <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">Activity Log</p>
              <p className="text-xs text-blue-600 dark:text-blue-400/80 mt-0.5">
                This is an activity log entry, not an approval request. No decision is needed.
              </p>
            </div>
          )}

          {/* Card: Details */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-y divide-border/40">
              {!approval.is_log && (
                <div className="p-3.5">
                  <LabelWithTip label="Status" tip="The current state of this request. Pending means it's waiting for someone to approve or reject it." />
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold", status.badge)}>
                    <span className={cn("size-1.5 rounded-full", status.dot)} />
                    {status.label}
                  </span>
                </div>
              )}

              {!approval.is_log && (
                <div className="p-3.5">
                  <LabelWithTip label="Priority" tip="How urgent this request is. Critical and high priority requests should be reviewed first." />
                  <PriorityBadge priority={approval.priority} />
                </div>
              )}

              <div className="p-3.5">
                <LabelWithTip label="Source" tip="The platform or tool that sent this request, like Zapier, Make, or a direct API call." />
                <div className="flex items-center gap-1.5">
                  <SourceAvatar approval={approval} size="sm" />
                  <span className="text-sm font-medium">
                    {approval.source ? approval.source.charAt(0).toUpperCase() + approval.source.slice(1) : "API"}
                  </span>
                </div>
              </div>

              <div className="p-3.5">
                <LabelWithTip label="Action Type" tip="An optional label describing what this request does, like &quot;deploy.production&quot; or &quot;user.delete&quot;. Set by the workflow that created the request." />
                <p className="text-sm font-mono truncate">{approval.action_type || "-"}</p>
              </div>

              <div className="p-3.5">
                <LabelWithTip label="Created" tip="When this request was first submitted for approval." />
                <p className="text-sm font-medium">{formatDistanceToNow(new Date(approval.created_at), { addSuffix: true })}</p>
              </div>

              <div className="p-3.5">
                <LabelWithTip label="Created By" tip="The person whose account was used to submit this request through the connected platform." />
                <p className="text-sm font-medium break-words">
                  {createdBy?.user_id ? (
                    <UserName
                      userId={createdBy.user_id}
                      userProfiles={userProfiles}
                      name={creatorName || undefined}
                    />
                  ) : (
                    creatorName || "-"
                  )}
                </p>
              </div>

              {approval.expires_at && (
                <div className="p-3.5">
                  <LabelWithTip label="Expires" tip="If no decision is made by this time, the request will automatically expire." />
                  <p className="text-sm font-medium">{formatDistanceToNow(new Date(approval.expires_at), { addSuffix: true })}</p>
                </div>
              )}

              {approval.decided_by && (
                <div className="p-3.5">
                  <LabelWithTip label="Decided By" tip="The person who approved or rejected this request." />
                  <p className="text-sm font-medium break-words">
                    <UserName userId={approval.decided_by} userProfiles={userProfiles} />
                  </p>
                </div>
              )}

              {/* Fill empty cell if odd number of items (6 base + optional expires/decided_by) */}
              {((approval.expires_at ? 1 : 0) + (approval.decided_by ? 1 : 0)) % 2 !== 0 && (
                <div className="p-3.5" />
              )}
            </div>
          </div>

          {/* Card: Approvals (hidden for activity logs) */}
          {!approval.is_log && <div className="rounded-xl border border-border/50 p-4">
            {hasMultiApproval ? (
              <LabelWithTip
                label={approval.is_sequential ? "Approval Chain" : "Approvals Required"}
                tip={approval.is_sequential
                  ? "Approvers must approve in order. The next person can only act after the previous one approves."
                  : `This request needs ${approval.required_approvals} people to approve before it goes through. They can approve in any order.`}
              />
            ) : hasAssignedApprovers ? (
              <LabelWithTip
                label="Assigned Approvers"
                tip="Specific team members chosen to review and decide on this request."
              />
            ) : (
              <LabelWithTip
                label="Approval Requirements"
                tip="How many approvals are needed and who is allowed to approve this request."
              />
            )}

            {hasMultiApproval ? (
              <div className="mt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">
                    {approval.current_approvals} of {approval.required_approvals} approvals
                  </span>
                  <span className="text-xs font-semibold text-muted-foreground">{progressPct}%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden mb-3">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      approval.status === "rejected" ? "bg-red-500" : "bg-emerald-500",
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                {hasAssignedApprovers && (
                  <div className="divide-y divide-border/30">
                    {approval.assigned_approvers!.map((userId, index) => {
                      const isCompleted = index < approval.current_approvals;
                      const isNext = index === approval.current_approvals && approval.status === "pending";
                      return (
                        <div key={userId} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                          {approval.is_sequential ? (
                            isCompleted ? <CheckCircle className="size-4 text-emerald-500 shrink-0" />
                            : isNext ? <ArrowRight className="size-4 text-primary shrink-0" />
                            : <Circle className="size-4 text-muted-foreground/25 shrink-0" />
                          ) : (
                            isCompleted ? <CheckCircle className="size-4 text-emerald-500 shrink-0" />
                            : <Circle className="size-4 text-muted-foreground/25 shrink-0" />
                          )}
                          <span className={cn("text-sm flex-1 min-w-0", isNext ? "font-semibold" : isCompleted ? "" : "text-muted-foreground")}>
                            <UserName userId={userId} userProfiles={userProfiles} />
                          </span>
                          {isCompleted && <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium shrink-0">Approved</span>}
                          {approval.is_sequential && isNext && <span className="text-[11px] text-primary font-medium shrink-0">Next</span>}
                          {!isCompleted && !isNext && <span className="text-[11px] text-muted-foreground/40 shrink-0">Waiting</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : hasAssignedApprovers ? (
              <div className="mt-1 divide-y divide-border/30">
                {approval.assigned_approvers!.map((userId) => (
                  <div key={userId} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                    <UserCheck className="size-4 text-muted-foreground/40 shrink-0" />
                    <span className="text-sm flex-1 min-w-0">
                      <UserName userId={userId} userProfiles={userProfiles} />
                    </span>
                    <span className="text-[11px] text-muted-foreground shrink-0">Assigned</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-muted-foreground/40" />
                  <span className="text-sm">
                    {approval.required_approvals === 1 ? "1 approval" : `${approval.required_approvals} approvals`} required
                  </span>
                </div>
                {approval.required_role && (
                  <span className="text-[11px] font-medium bg-muted rounded-md px-2 py-0.5 capitalize">{approval.required_role}+</span>
                )}
              </div>
            )}

            {/* Watch/Unwatch toggle */}
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-3"
              onClick={toggleWatch}
            >
              {isWatching ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {isWatching ? "Unwatch" : "Watch"}
              {watcherCount > 0 && (
                <span className="ml-1 text-muted-foreground">· {watcherCount}</span>
              )}
            </Button>

            {approval.flow_id && onConfigureFlow && canManageFlows && (
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => onConfigureFlow(approval)}
              >
                <Settings2 className="size-3.5" />
                Configure Flow Rules
              </Button>
            )}
          </div>}

          {/* You're up banner: user is the responsible approver */}
          {approval.status === "pending" && hasAssignedApprovers && isResponsibleApprover && (!isSelfCreated || allowSelfApproval) && canApprove && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200/60 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/20 px-4 py-3">
              <UserCheck className="size-4 shrink-0 text-emerald-500 mt-0.5" />
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                <span className="font-semibold">You&rsquo;re up.</span>
                {approval.is_sequential && approval.assigned_approvers!.length > 1
                  ? ` Decide to advance the chain (${approval.current_approvals + 1} of ${approval.assigned_approvers!.length}).`
                  : " Review and decide below."}
              </p>
            </div>
          )}

          {/* Card: Context */}
          {approval.context_html && (
            <div className="rounded-xl border border-border/50 p-4">
              <LabelWithTip label="Context" tip="Extra details provided by the workflow to help you understand what you're approving." />
              <div
                className="prose prose-sm max-w-none mt-1"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(approval.context_html) }}
              />
            </div>
          )}

          {/* Card: Metadata */}
          {approval.metadata && Object.keys(approval.metadata).length > 0 && (
            <div className="rounded-xl border border-border/50 p-4">
              <LabelWithTip label="Metadata" tip="Custom data sent along with the request. This can include IDs, environment info, or anything the workflow wanted to pass along." />
              <div className="mt-2 rounded-lg border border-border/50 overflow-hidden">
                <table className="w-full text-left">
                  <tbody className="divide-y divide-border/50">
                    {Object.entries(approval.metadata).map(([key, value]) => (
                      <tr key={key}>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground w-2/5 align-top bg-muted/30">{key}</td>
                        <td className="px-4 py-2.5 text-sm break-all font-medium">
                          {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Card: Decision */}
          {effectiveCanApprove && (
            <div className="rounded-xl border border-border/50 p-4">
              <LabelWithTip label="Your Decision" tip="Approve or reject this request. Your decision gets sent back to the workflow that created it." />
              <div className="mt-1">
                <ApprovalResponseForm
                  onRespond={(decision, comment) => onRespond(approval.id, decision, comment)}
                  isLoading={isLoading}
                />
              </div>
            </div>
          )}

          {approval.status === "pending" && !approval.is_log && !effectiveCanApprove && (
            <div className="rounded-xl border border-border/50 p-4">
              <p className="text-muted-foreground text-sm text-center">
                {!canApprove ? (
                  "You do not have approval permissions. Contact your admin."
                ) : hasAssignedApprovers ? (
                  approval.is_sequential ? (
                    userAlreadyApprovedSequential ? (
                      <>
                        You approved this request. Waiting on{" "}
                        <UserName
                          userId={approval.assigned_approvers![approval.current_approvals]}
                          userProfiles={userProfiles}
                        />
                        .
                      </>
                    ) : isSelfAnAssignedApprover ? (
                      <>
                        Waiting on{" "}
                        <UserName
                          userId={approval.assigned_approvers![approval.current_approvals]}
                          userProfiles={userProfiles}
                        />
                        . You&rsquo;re later in the approval chain.
                      </>
                    ) : (
                      <>
                        You&rsquo;re not assigned to this request. Waiting on{" "}
                        <UserName
                          userId={approval.assigned_approvers![approval.current_approvals]}
                          userProfiles={userProfiles}
                        />
                        .
                      </>
                    )
                  ) : isSelfAnAssignedApprover ? (
                    <>
                      You already responded to this request. Waiting on{" "}
                      {remainingApprovers.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          <UserName userId={id} userProfiles={userProfiles} />
                        </span>
                      ))}
                      .
                    </>
                  ) : (
                    <>
                      You&rsquo;re not assigned to this request. Waiting on{" "}
                      {remainingApprovers.map((id, i) => (
                        <span key={id}>
                          {i > 0 && ", "}
                          <UserName userId={id} userProfiles={userProfiles} />
                        </span>
                      ))}
                      .
                    </>
                  )
                ) : isSelfCreated && !allowSelfApproval ? (
                  "You created this request. Another approver must decide."
                ) : (
                  "Only approvers assigned to this request can decide."
                )}
              </p>
            </div>
          )}

          {/* Card: Activity */}
          <div className="rounded-xl border border-border/50 p-4">
            <LabelWithTip label="Activity" tip="A timeline of everything that happened with this request: when it was created, decided, and any comments." />
            <div className="mt-3 space-y-0">
              <div className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="size-2 rounded-full bg-muted-foreground/40 mt-1.5 shrink-0" />
                  {(approval.decided_at || approval.decision_comment) && (
                    <div className="w-px flex-1 bg-border mt-1" />
                  )}
                </div>
                <div className="pb-4 min-w-0">
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-xs text-muted-foreground">{format(new Date(approval.created_at), "PPp")}</p>
                </div>
              </div>

              {approval.decided_at && !approval.is_log && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "size-2 rounded-full mt-1.5 shrink-0",
                      approval.status === "approved" ? "bg-emerald-500" : approval.status === "rejected" ? "bg-red-500" : "bg-muted-foreground/40"
                    )} />
                    {approval.decision_comment && <div className="w-px flex-1 bg-border mt-1" />}
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className="text-sm font-medium capitalize">
                      {approval.status}
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                        after {formatDuration(approval.created_at, approval.decided_at)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(approval.decided_at), "PPp")}
                      {approval.decided_by && (
                        <span>
                          {" "}by{" "}
                          <UserName userId={approval.decided_by} userProfiles={userProfiles} />
                        </span>
                      )}
                      {approval.decision_source && <span> via {approval.decision_source}</span>}
                    </p>
                  </div>
                </div>
              )}

              {approval.is_log && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="size-2 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                  </div>
                  <div className="pb-4 min-w-0">
                    <p className="text-sm font-medium text-blue-700">Logged as Activity</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(approval.created_at), "PPp")}
                    </p>
                  </div>
                </div>
              )}

              {approval.decision_comment && (
                <div className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <MessageSquare className="size-3 text-muted-foreground/40 mt-1.5 shrink-0" />
                  </div>
                  <div className="pb-2 min-w-0">
                    <p className="text-xs text-muted-foreground break-words italic">
                      &ldquo;{approval.decision_comment}&rdquo;
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card: Comments */}
          <div className="rounded-xl border border-border/50 p-4">
            <LabelWithTip
              label={`Comments${comments.length > 0 ? ` (${comments.length})` : ""}`}
              tip="Discussion thread for this request. Comments can be posted by team members or external apps like Zapier and Make."
            />
            <div className="mt-1">
              <ApprovalComments
                requestId={approval.id}
                comments={comments}
                onCommentAdded={handleCommentAdded}
                onCommentDeleted={(commentId) => {
                  setComments((prev) => prev.filter((c) => c.id !== commentId));
                }}
                userProfiles={userProfiles}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
});
