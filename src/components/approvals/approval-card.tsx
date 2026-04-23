"use client";

import { useState, useMemo, memo } from "react";
import { useOnboardingTourStore } from "@/stores/onboarding-tour-store";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { PriorityBadge } from "@/components/approvals/priority-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDistanceToNow } from "date-fns";
import { Clock, CheckCircle, XCircle, User2, MoreVertical, Eye, Archive, ArchiveRestore, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SourceAvatar, getSourceDisplay } from "@/components/approvals/source-icons";
import { canDecideOnApproval } from "@/lib/approvals/responsible";
import { canArchiveApproval } from "@/lib/approvals/archive";
import type { ApprovalRequest } from "@/lib/types/database";

interface ApprovalCardProps {
  approval: ApprovalRequest;
  connectionName?: string;
  creatorName?: string;
  currentlyResponsible?: string | null;
  onClick: () => void;
  canApprove?: boolean;
  /** Controls whether the inline "Configure Flow" icon button renders. */
  canManageFlows?: boolean;
  /** Current user's org role, used with canArchiveApproval to hide the
   * Archive/Unarchive items for mere approvers. */
  userRole?: string;
  /** Teams this user is a lead of — archive is visible on requests
   * assigned to one of these teams. */
  leadTeamIds?: ReadonlySet<string>;
  currentUserId?: string;
  delegatorIds?: ReadonlySet<string>;
  isLoading?: boolean;
  skipConfirmation?: boolean;
  onInlineAction?: (approvalId: string, decision: "approved" | "rejected", comment?: string) => void;
  onSkipConfirmationChange?: (skip: boolean) => void;
  isNew?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onArchive?: (approvalId: string) => void;
  onUnarchive?: (approvalId: string) => void;
  onConfigureFlow?: (approval: ApprovalRequest) => void;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pending", variant: "outline" },
  approved: { label: "Approved", variant: "default" },
  rejected: { label: "Rejected", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  expired: { label: "Expired", variant: "secondary" },
};

const statusBorderColors: Record<string, string> = {
  pending: "border-l-amber-400",
  approved: "border-l-emerald-400",
  rejected: "border-l-red-400",
  cancelled: "border-l-zinc-300",
  expired: "border-l-zinc-300",
};

const statusGlowColors: Record<string, string> = {
  pending: "card-glow-amber",
  approved: "card-glow-emerald",
  rejected: "card-glow-red",
  cancelled: "card-interactive",
  expired: "card-interactive",
};


export const ApprovalCard = memo(function ApprovalCard({
  approval,
  connectionName,
  creatorName,
  currentlyResponsible,
  onClick,
  canApprove = true,
  canManageFlows = false,
  userRole,
  leadTeamIds,
  currentUserId,
  delegatorIds,
  isLoading = false,
  skipConfirmation = false,
  onInlineAction,
  onSkipConfirmationChange,
  isNew = false,
  isSelected = false,
  onToggleSelect,
  onArchive,
  onUnarchive,
  onConfigureFlow,
}: ApprovalCardProps) {
  const [confirmDialog, setConfirmDialog] = useState<"approved" | "rejected" | null>(null);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [comment, setComment] = useState("");

  const status = statusConfig[approval.status] ?? {
    label: approval.status,
    variant: "outline" as const,
  };
  const borderColor = approval.is_log ? "border-l-blue-400" : (statusBorderColors[approval.status] ?? "border-l-zinc-300");
  const glowColor = approval.is_log ? "card-interactive" : (statusGlowColors[approval.status] ?? "card-interactive");

  const isPending = approval.status === "pending";
  const now = useMemo(() => new Date(), []);

  // Tour: force-show hover actions on the onboarding test request
  const isOnboardingRequest = approval.source === "onboarding";
  const { activePageId, currentStepInPage } = useOnboardingTourStore();
  const tourShowApproveButtons = isOnboardingRequest && activePageId === "requests" && currentStepInPage === 1;
  const tourShowMoreMenu = isOnboardingRequest && activePageId === "requests" && currentStepInPage === 2;
  const tourForceVisible = tourShowApproveButtons || tourShowMoreMenu;

  const handleInlineClick = (
    e: React.MouseEvent,
    decision: "approved" | "rejected",
  ) => {
    e.stopPropagation();
    if (skipConfirmation) {
      onInlineAction?.(approval.id, decision);
    } else {
      setConfirmDialog(decision);
    }
  };

  const handleConfirm = () => {
    if (confirmDialog) {
      if (dontAskAgain) {
        onSkipConfirmationChange?.(true);
      }
      onInlineAction?.(approval.id, confirmDialog, comment || undefined);
      setConfirmDialog(null);
      setDontAskAgain(false);
      setComment("");
    }
  };

  return (
    <>
      <Card
        className={cn(
          "group/card cursor-pointer border-0 border-l-4 transition-all",
          borderColor,
          glowColor,
          isNew && "ring-2 ring-emerald-400/60 animate-in fade-in slide-in-from-bottom-1 duration-500",
        )}
        data-tour={approval.source === "onboarding" ? "test-request" : undefined}
        onClick={onClick}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Checkbox */}
          {onToggleSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(approval.id)}
              onClick={(e) => e.stopPropagation()}
              className="shrink-0"
            />
          )}

          {/* Source avatar */}
          <SourceAvatar approval={approval} connectionName={connectionName} size="md" />

          {/* Main content */}
          <div className="min-w-0 flex-1">
            {/* Title row */}
            <div className="flex items-center gap-2">
              {isPending && (
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
                </span>
              )}
              <CardTitle className="line-clamp-1 text-sm font-medium">
                {approval.title}
              </CardTitle>
            </div>

            {/* Metadata row */}
            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
              {/* Source label (text only, avatar already shows the icon) */}
              <span>{getSourceDisplay(approval, connectionName).label}</span>
              {/* Show the account owner who created the connection */}
              {creatorName && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span className="flex items-center gap-1 truncate">
                    <User2 className="size-3 shrink-0" />
                    {creatorName}
                  </span>
                </>
              )}
              {approval.action_type && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px]">
                    {approval.action_type}
                  </span>
                </>
              )}
              <span className="text-muted-foreground/40">|</span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {formatDistanceToNow(new Date(approval.created_at), {
                  addSuffix: true,
                })}
              </span>
              {isPending && (now.getTime() - new Date(approval.created_at).getTime()) > 3600000 && (
                <>
                  <span className="text-muted-foreground/40">|</span>
                  <span className="text-amber-600 font-medium">
                    Waiting {Math.floor((now.getTime() - new Date(approval.created_at).getTime()) / 3600000)}h
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Right side: badges + hover actions */}
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
            {/* Activity log badge */}
            {approval.is_log && (
              <Badge variant="outline" className="text-[11px] gap-1 border-blue-200 text-blue-600 bg-blue-50">
                Activity Log
              </Badge>
            )}
            {/* Inline approve/reject - visible on hover (hidden for logs).
                Gated to the user who is currently responsible: hides for
                viewers, non-assigned approvers, and self-created requests. */}
            {onInlineAction && canDecideOnApproval(approval, currentUserId, canApprove, delegatorIds) && (
              <div className={cn(
                "hidden items-center gap-1.5 sm:flex sm:transition-opacity",
                tourShowApproveButtons ? "sm:opacity-100" : "sm:opacity-0 sm:group-hover/card:opacity-100",
              )}>
                <Button
                  size="sm"
                  variant="success"
                  className="h-7 gap-1 px-2.5 text-xs"
                  disabled={isLoading}
                  onClick={(e) => handleInlineClick(e, "approved")}
                >
                  <CheckCircle className="size-3.5" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-7 gap-1 px-2.5 text-xs"
                  disabled={isLoading}
                  onClick={(e) => handleInlineClick(e, "rejected")}
                >
                  <XCircle className="size-3.5" />
                  Reject
                </Button>
              </div>
            )}
            {!approval.is_log && <PriorityBadge priority={approval.priority} />}
            {approval.archived_at && (
              <Badge variant="secondary" className="text-[11px]">Archived</Badge>
            )}
            {!approval.is_log && <Badge variant={status.variant} className="text-[11px]">{status.label}</Badge>}
            {currentlyResponsible && (
              <span className="flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/30 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                <User2 className="size-3 shrink-0" />
                <span>{currentlyResponsible}</span>
              </span>
            )}

            {/* Action buttons - visible on hover */}
            <div className={cn(
              "hidden items-center gap-0.5 sm:flex sm:transition-opacity",
              tourForceVisible ? "sm:opacity-100" : "sm:opacity-0 sm:group-hover/card:opacity-100",
            )}>
              {approval.flow_id && onConfigureFlow && !approval.is_log && canManageFlows && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-7 p-0"
                  title="Configure Flow"
                  onClick={(e) => {
                    e.stopPropagation();
                    onConfigureFlow(approval);
                  }}
                >
                  <Settings2 className="size-4" />
                </Button>
              )}

              {/* During tour step 3: show a static fake menu (no Radix event interception) */}
              {tourShowMoreMenu && (
                <div className="relative">
                  <Button variant="ghost" size="sm" className="size-7 p-0">
                    <MoreVertical className="size-4" />
                  </Button>
                  <div
                    data-tour="test-request-more-menu"
                    className="absolute right-0 top-full mt-1 min-w-[8rem] rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
                  >
                    <div className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm">
                      <Eye className="size-4 text-muted-foreground" />
                      Details
                    </div>
                    <div className="bg-border -mx-1 my-1 h-px" />
                    <div className="flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm">
                      <Archive className="size-4 text-muted-foreground" />
                      Archive
                    </div>
                  </div>
                </div>
              )}
              {/* Normal dropdown (hidden during tour step 3) */}
              <DropdownMenu open={undefined}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("size-7 p-0", tourShowMoreMenu && "hidden")}
                    onClick={(e) => e.stopPropagation()}
                    data-tour={isOnboardingRequest ? "test-request-more-btn" : undefined}
                  >
                    <MoreVertical className="size-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                  <DropdownMenuItem onClick={onClick}>
                    <Eye className="size-4" />
                    Details
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {canArchiveApproval(approval, currentUserId, userRole, leadTeamIds) && (
                    approval.archived_at ? (
                      onUnarchive && (
                        <DropdownMenuItem onClick={() => onUnarchive(approval.id)}>
                          <ArchiveRestore className="size-4" />
                          Unarchive
                        </DropdownMenuItem>
                      )
                    ) : (
                      onArchive && (
                        <DropdownMenuItem onClick={() => onArchive(approval.id)}>
                          <Archive className="size-4" />
                          Archive
                        </DropdownMenuItem>
                      )
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </Card>

      {/* Confirmation dialog */}
      <Dialog open={confirmDialog !== null} onOpenChange={(open) => { if (!open) { setConfirmDialog(null); setComment(""); } }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog === "approved" ? "Approve" : "Reject"} this request?
            </DialogTitle>
            <DialogDescription>
              You are about to {confirmDialog === "approved" ? "approve" : "reject"}{" "}
              &quot;{approval.title}&quot;. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder={
              confirmDialog === "rejected"
                ? "Why is this request being rejected?"
                : "Add a comment (optional)..."
            }
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            className="resize-none"
          />
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`dont-ask-${approval.id}`}
              checked={dontAskAgain}
              onCheckedChange={(checked) => setDontAskAgain(checked === true)}
            />
            <label
              htmlFor={`dont-ask-${approval.id}`}
              className="text-sm text-muted-foreground cursor-pointer select-none"
            >
              Don&apos;t ask me again
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConfirmDialog(null); setComment(""); }}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              className={cn(
                "!text-white cursor-pointer",
                confirmDialog === "approved"
                  ? "!bg-emerald-600 hover:!bg-emerald-700"
                  : "!bg-red-600 hover:!bg-red-700"
              )}
            >
              {confirmDialog === "approved" ? "Approve" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
