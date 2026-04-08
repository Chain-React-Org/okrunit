"use client";

import { ApprovalCard } from "@/components/approvals/approval-card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { InboxIcon } from "lucide-react";
import { getCurrentlyResponsible } from "@/lib/approvals/responsible";
import type { ApprovalRequest, Connection, UserProfile } from "@/lib/types/database";

interface ApprovalListGroupedProps {
  approvals: ApprovalRequest[];
  connections: Connection[];
  approvalCreators?: Record<string, string>;
  teamsMap?: Record<string, string>;
  userProfiles?: Map<string, UserProfile>;
  onSelect: (approval: ApprovalRequest) => void;
  canApprove?: boolean;
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
}

export function ApprovalListGrouped({
  approvals,
  connections,
  approvalCreators = {},
  teamsMap = {},
  userProfiles = new Map(),
  onSelect,
  canApprove = true,
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

  const needsAttention = approvals.filter((a) => a.status === "pending");
  const resolved = approvals.filter((a) => a.status !== "pending");

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
          <div className="grid gap-3">
            {needsAttention.map((approval) => (
              <ApprovalCard
                key={approval.id}
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
            ))}
          </div>
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
              {resolved.length}
            </span>
          </div>
          <div className="grid gap-3">
            {resolved.map((approval) => (
              <div key={approval.id} className="opacity-75">
                <ApprovalCard
                  approval={approval}
                  connectionName={
                    approval.connection_id
                      ? connectionMap.get(approval.connection_id)
                      : undefined
                  }
                  onClick={() => onSelect(approval)}
                  canApprove={canApprove}
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
        </section>
      )}
    </div>
  );
}
