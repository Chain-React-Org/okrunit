"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Batch Actions Bar: Sticky bottom bar for bulk actions
// ---------------------------------------------------------------------------

import { useState, memo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, XCircle, X, Loader2, Archive, ArchiveRestore } from "lucide-react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BatchActionsBarProps {
  selectedIds: string[];
  onClear: () => void;
  onBatchAction: (decision: "approve" | "reject") => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BatchActionsBar = memo(function BatchActionsBar({
  selectedIds,
  onClear,
  onBatchAction,
  onArchive,
  onUnarchive,
}: BatchActionsBarProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<
    "approve" | "reject" | "archive" | "unarchive" | null
  >(null);

  if (selectedIds.length === 0) return null;

  async function handleAction(decision: "approve" | "reject") {
    setIsLoading(true);
    setLoadingAction(decision);

    try {
      const response = await fetch("/api/v1/approvals/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          decision,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(
          errorData?.error ?? `Request failed with status ${response.status}`,
        );
      }

      const result = await response.json();

      if (result.errors?.length > 0) {
        toast.warning(
          `Processed ${result.processed} approvals with ${result.errors.length} error(s)`,
          {
            description: result.errors
              .slice(0, 3)
              .map((e: { id: string; error: string }) => e.error)
              .join(", "),
          },
        );
      } else {
        toast.success(
          `Successfully ${decision === "approve" ? "approved" : "rejected"} ${result.processed} approval(s)`,
        );
      }

      // Notify parent so it can refresh data and clear selection
      onBatchAction(decision);
    } catch (error) {
      toast.error(
        `Failed to ${decision} approvals`,
        {
          description:
            error instanceof Error ? error.message : "An unexpected error occurred",
        },
      );
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleArchive() {
    setIsLoading(true);
    setLoadingAction("archive");
    try {
      await onArchive?.();
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }

  async function handleUnarchive() {
    setIsLoading(true);
    setLoadingAction("unarchive");
    try {
      await onUnarchive?.();
    } finally {
      setIsLoading(false);
      setLoadingAction(null);
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/80 backdrop-blur-sm md:left-20">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-sm">
            {selectedIds.length} selected
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="success"
            size="sm"
            disabled={isLoading}
            onClick={() => handleAction("approve")}
          >
            {loadingAction === "approve" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Approve All
          </Button>

          <Button
            variant="destructive"
            size="sm"
            disabled={isLoading}
            onClick={() => handleAction("reject")}
          >
            {loadingAction === "reject" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            Reject All
          </Button>

          {onArchive && (
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={handleArchive}
            >
              {loadingAction === "archive" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Archive className="size-4" />
              )}
              Archive
            </Button>
          )}

          {onUnarchive && (
            <Button
              variant="outline"
              size="sm"
              disabled={isLoading}
              onClick={handleUnarchive}
            >
              {loadingAction === "unarchive" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArchiveRestore className="size-4" />
              )}
              Unarchive
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            disabled={isLoading}
            onClick={onClear}
          >
            <X className="size-4" />
            Clear Selection
          </Button>
        </div>
      </div>
    </div>
  );
});
