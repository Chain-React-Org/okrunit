"use client";

import { memo, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ApprovalCard } from "@/components/approvals/approval-card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { InboxIcon } from "lucide-react";
import { getCurrentlyResponsible, canDecideOnApproval } from "@/lib/approvals/responsible";
import type { ApprovalRequest, Connection, UserProfile } from "@/lib/types/database";

/** Threshold: only virtualize sections with this many items or more */
const VIRTUALIZE_THRESHOLD = 50;

/** Estimated height (in px) per approval card row including the gap */
const ESTIMATED_ITEM_HEIGHT = 68;

interface ApprovalListGroupedProps {
  approvals: ApprovalRequest[];
  connections: Connection[];
  approvalCreators?: Record<string, string>;
  teamsMap?: Record<string, string>;
  userProfiles?: Map<string, UserProfile>;
  onSelect: (approval: ApprovalRequest) => void;
  canApprove?: boolean;
  canManageFlows?: boolean;
  userRole?: string;
  currentUserId?: string;
  delegatorIds?: ReadonlySet<string>;
  /** Teams the current user leads — used to show archive on requests
   * assigned to a team they run. */
  leadTeamIds?: ReadonlySet<string>;
  isLoading?: boolean;
  skipConfirmation?: boolean;
  onInlineAction?: (approvalId: string, decision: "approved" | "rejected", comment?: string) => void;
  onSkipConfirmationChange?: (skip: boolean) => void;
  newIds?: Set<string>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectSection?: (ids: string[]) => void;
  onArchive?: (approvalId: string) => void;
  onUnarchive?: (approvalId: string) => void;
  onConfigureFlow?: (approval: ApprovalRequest) => void;
  /** Total pending count across all pages (not just current page) */
  totalPendingCount?: number;
  /** Total resolved count across all pages (not just current page) */
  totalResolvedCount?: number;
}

/**
 * Virtualized list for a single approval section.
 * Uses @tanstack/react-virtual to only render visible items.
 */
function VirtualizedSection({
  items,
  connectionMap,
  approvalCreators,
  userProfiles,
  teamsLookup,
  onSelect,
  canApprove,
  canManageFlows,
  userRole,
  currentUserId,
  delegatorIds,
  leadTeamIds,
  isLoading,
  skipConfirmation,
  onInlineAction,
  onSkipConfirmationChange,
  newIds,
  selectedIds,
  onToggleSelect,
  onArchive,
  onUnarchive,
  onConfigureFlow,
  wrapperClassName,
}: {
  items: ApprovalRequest[];
  connectionMap: Map<string, string>;
  approvalCreators: Record<string, string>;
  userProfiles: Map<string, UserProfile>;
  teamsLookup: Map<string, { id: string; name: string }>;
  onSelect: (approval: ApprovalRequest) => void;
  canApprove: boolean;
  canManageFlows: boolean;
  userRole?: string;
  leadTeamIds?: ReadonlySet<string>;
  currentUserId?: string;
  delegatorIds?: ReadonlySet<string>;
  isLoading: boolean;
  skipConfirmation: boolean;
  onInlineAction?: (approvalId: string, decision: "approved" | "rejected", comment?: string) => void;
  onSkipConfirmationChange?: (skip: boolean) => void;
  newIds?: Set<string>;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onArchive?: (approvalId: string) => void;
  onUnarchive?: (approvalId: string) => void;
  onConfigureFlow?: (approval: ApprovalRequest) => void;
  wrapperClassName?: string;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ITEM_HEIGHT,
    overscan: 10,
  });

  return (
    <div
      ref={parentRef}
      className="overflow-auto"
      style={{ maxHeight: "70vh" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const approval = items[virtualItem.index];
          return (
            <div
              key={approval.id}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className={wrapperClassName}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className="pb-3">
                <ApprovalCard
                  approval={approval}
                  connectionName={
                    approval.connection_id
                      ? connectionMap.get(approval.connection_id)
                      : undefined
                  }
                  creatorName={approvalCreators[approval.id]}
                  currentlyResponsible={getCurrentlyResponsible(approval, userProfiles, teamsLookup)}
                  onClick={() => onSelect(approval)}
                  canApprove={canApprove}
                  canManageFlows={canManageFlows}
                  userRole={userRole}
                  currentUserId={currentUserId}
                  delegatorIds={delegatorIds}
                  leadTeamIds={leadTeamIds}
                  isLoading={isLoading}
                  skipConfirmation={skipConfirmation}
                  onInlineAction={onInlineAction}
                  onSkipConfirmationChange={onSkipConfirmationChange}
                  isNew={newIds?.has(approval.id)}
                  isSelected={selectedIds?.has(approval.id)}
                  onToggleSelect={onToggleSelect}
                  onArchive={onArchive}
                  onUnarchive={onUnarchive}
                  onConfigureFlow={onConfigureFlow}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ApprovalListGrouped = memo(function ApprovalListGrouped({
  approvals,
  connections,
  approvalCreators = {},
  teamsMap = {},
  userProfiles = new Map(),
  onSelect,
  canApprove = true,
  canManageFlows = false,
  userRole,
  currentUserId,
  delegatorIds,
  leadTeamIds,
  isLoading = false,
  skipConfirmation = false,
  onInlineAction,
  onSkipConfirmationChange,
  newIds,
  selectedIds,
  onToggleSelect,
  onToggleSelectSection,
  onArchive,
  onUnarchive,
  onConfigureFlow,
  totalPendingCount,
  totalResolvedCount,
}: ApprovalListGroupedProps) {
  const connectionMap = new Map(connections.map((c) => [c.id, c.name]));
  const teamsLookup = new Map(Object.entries(teamsMap).map(([id, name]) => [id, { id, name }]));

  if (approvals.length === 0) {
    return (
      <EmptyState
        icon={InboxIcon}
        title="No approval requests found"
        description="Approval requests from your connected services will appear here."
      />
    );
  }

  // Split pending into two buckets so a user who's already taken their
  // turn (or is later in the chain) doesn't keep seeing the request under
  // "Needs Your Attention". Uses the same eligibility gate as the detail
  // panel's Approve/Reject buttons so the groupings can never drift from
  // what the user can actually do.
  const pending = approvals.filter((a) => a.status === "pending");
  const needsAttention = pending.filter((a) =>
    canDecideOnApproval(a, currentUserId, !!canApprove, delegatorIds),
  );
  const awaitingOthers = pending.filter(
    (a) => !canDecideOnApproval(a, currentUserId, !!canApprove, delegatorIds),
  );
  const resolved = approvals.filter((a) => a.status !== "pending");

  const sharedProps = {
    connectionMap,
    approvalCreators,
    userProfiles,
    teamsLookup,
    onSelect,
    canApprove,
    canManageFlows,
    userRole,
    currentUserId,
    delegatorIds,
    leadTeamIds,
    isLoading,
    skipConfirmation,
    onInlineAction,
    onSkipConfirmationChange,
    newIds,
    selectedIds,
    onToggleSelect,
    onArchive,
    onUnarchive,
    onConfigureFlow,
  };

  const renderCards = (items: ApprovalRequest[], wrapperClassName?: string) => (
    <div className="grid gap-3">
      {items.map((approval) => (
        <div key={approval.id} className={wrapperClassName}>
          <ApprovalCard
            approval={approval}
            connectionName={
              approval.connection_id
                ? connectionMap.get(approval.connection_id)
                : undefined
            }
            creatorName={approvalCreators[approval.id]}
            currentlyResponsible={getCurrentlyResponsible(approval, userProfiles, teamsLookup)}
            onClick={() => onSelect(approval)}
            canApprove={canApprove}
            canManageFlows={canManageFlows}
            currentUserId={currentUserId}
            delegatorIds={delegatorIds}
            isLoading={isLoading}
            skipConfirmation={skipConfirmation}
            onInlineAction={onInlineAction}
            onSkipConfirmationChange={onSkipConfirmationChange}
            isNew={newIds?.has(approval.id)}
            isSelected={selectedIds?.has(approval.id)}
            onToggleSelect={onToggleSelect}
            onArchive={onArchive}
            onUnarchive={onUnarchive}
            onConfigureFlow={onConfigureFlow}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {needsAttention.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            {onToggleSelectSection && (
              <Checkbox
                checked={needsAttention.every((a) => selectedIds?.has(a.id))}
                onCheckedChange={() => onToggleSelectSection(needsAttention.map((a) => a.id))}
                className="bg-white dark:bg-zinc-900"
              />
            )}
            <span className="text-sm font-medium text-foreground">
              Needs Your Attention
            </span>
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-medium">
              {needsAttention.length}
            </span>
          </div>
          {needsAttention.length >= VIRTUALIZE_THRESHOLD ? (
            <VirtualizedSection items={needsAttention} {...sharedProps} />
          ) : (
            renderCards(needsAttention)
          )}
        </section>
      )}

      {awaitingOthers.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            {onToggleSelectSection && (
              <Checkbox
                checked={awaitingOthers.every((a) => selectedIds?.has(a.id))}
                onCheckedChange={() => onToggleSelectSection(awaitingOthers.map((a) => a.id))}
                className="bg-white dark:bg-zinc-900"
              />
            )}
            <span className="text-sm font-medium text-foreground">
              Awaiting Others
            </span>
            <span className="bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-0.5 rounded-full text-xs font-medium">
              {awaitingOthers.length}
            </span>
          </div>
          {awaitingOthers.length >= VIRTUALIZE_THRESHOLD ? (
            <VirtualizedSection items={awaitingOthers} {...sharedProps} />
          ) : (
            renderCards(awaitingOthers)
          )}
        </section>
      )}

      {resolved.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-3">
            {onToggleSelectSection && (
              <Checkbox
                checked={resolved.every((a) => selectedIds?.has(a.id))}
                onCheckedChange={() => onToggleSelectSection(resolved.map((a) => a.id))}
                className="bg-white dark:bg-zinc-900"
              />
            )}
            <span className="text-sm font-medium text-muted-foreground">
              Previously Resolved
            </span>
            <span className="bg-muted px-2 py-0.5 rounded-full text-xs">
              {totalResolvedCount ?? resolved.length}
            </span>
          </div>
          {resolved.length >= VIRTUALIZE_THRESHOLD ? (
            <VirtualizedSection items={resolved} {...sharedProps} wrapperClassName="opacity-75" />
          ) : (
            renderCards(resolved, "opacity-75")
          )}
        </section>
      )}
    </div>
  );
});
