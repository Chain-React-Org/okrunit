"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { ApprovalFilters } from "@/components/approvals/approval-filters";
import { ApprovalList } from "@/components/approvals/approval-list";
import { ApprovalListGrouped } from "@/components/approvals/approval-list-grouped";
import { ApprovalListMasterDetail } from "@/components/approvals/approval-list-master-detail";
import { ApprovalDetail } from "@/components/approvals/approval-detail";
import { LayoutToggle } from "@/components/approvals/layout-toggle";
import { StatCard } from "@/components/ui/stat-card";
import { Pagination } from "@/components/ui/pagination";
import { useApprovalFiltersStore } from "@/stores/approval-filters-store";
import { useRealtime } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle, RefreshCw, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BatchActionsBar } from "@/components/approvals/batch-actions-bar";
import { FlowConfigDialog } from "@/components/approvals/flow-config-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import type { ApprovalRequest, Connection, DashboardLayout, UserProfile } from "@/lib/types/database";

interface ApprovalDashboardProps {
  initialApprovals: ApprovalRequest[];
  connections: Connection[];
  approvalCreators?: Record<string, string>;
  canApprove?: boolean;
  orgId: string;
}

export function ApprovalDashboard({
  initialApprovals,
  connections,
  approvalCreators = {},
  canApprove = true,
  orgId,
}: ApprovalDashboardProps) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(initialApprovals);
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [layout, setLayout] = useState<DashboardLayout>("cards");
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const newIdTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);

  const { status, priority, search, source, showArchived, setStatus, setPriority, setSearch, setSource, setShowArchived } =
    useApprovalFiltersStore();

  // Collect all user IDs referenced in approvals and fetch their profiles
  const referencedUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of approvals) {
      if (a.decided_by) ids.add(a.decided_by);
      if (a.assigned_approvers) {
        for (const id of a.assigned_approvers) ids.add(id);
      }
      if (a.created_by?.user_id) ids.add(a.created_by.user_id);
    }
    return ids;
  }, [approvals]);

  useEffect(() => {
    const idsToFetch = [...referencedUserIds].filter((id) => !userProfiles.has(id));
    if (idsToFetch.length === 0) return;

    const fetchProfiles = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("user_profiles")
        .select("id, email, full_name, avatar_url")
        .in("id", idsToFetch);

      if (data && data.length > 0) {
        setUserProfiles((prev) => {
          const next = new Map(prev);
          for (const profile of data) {
            next.set(profile.id, profile as UserProfile);
          }
          return next;
        });
      }
    };
    fetchProfiles();
  }, [referencedUserIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load preferences from notification_settings
  useEffect(() => {
    const loadPreferences = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notification_settings")
        .select("skip_approval_confirmation, dashboard_layout")
        .eq("user_id", user.id)
        .single();

      if (data?.skip_approval_confirmation) {
        setSkipConfirmation(true);
      }
      if (data?.dashboard_layout) {
        setLayout(data.dashboard_layout as DashboardLayout);
      }
    };
    loadPreferences();
  }, []);

  // Persist layout preference
  const handleLayoutChange = useCallback(async (newLayout: DashboardLayout) => {
    setLayout(newLayout);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notification_settings")
      .upsert({
        user_id: user.id,
        dashboard_layout: newLayout,
      }, { onConflict: "user_id" });
  }, []);

  // Track new IDs with auto-clear
  const markAsNew = useCallback((id: string) => {
    setNewIds((prev) => new Set(prev).add(id));
    // Clear existing timer if any
    const existing = newIdTimers.current.get(id);
    if (existing) clearTimeout(existing);
    // Auto-clear after 2.5s
    const timer = setTimeout(() => {
      setNewIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      newIdTimers.current.delete(id);
    }, 2500);
    newIdTimers.current.set(id, timer);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      newIdTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  // Realtime: listen for new and updated approval requests
  useRealtime<ApprovalRequest>({
    table: "approval_requests",
    filter: `org_id=eq.${orgId}`,
    onInsert: useCallback((record: ApprovalRequest) => {
      setApprovals((prev) => {
        if (prev.some((a) => a.id === record.id)) return prev;
        return [record, ...prev];
      });
      markAsNew(record.id);
      toast.info("New approval request received");
    }, [markAsNew]),
    onUpdate: useCallback((record: ApprovalRequest) => {
      setApprovals((prev) =>
        prev.map((a) => (a.id === record.id ? record : a))
      );
      setSelectedApproval((prev) =>
        prev?.id === record.id ? record : prev
      );
    }, []),
    onDelete: useCallback((oldRecord: ApprovalRequest) => {
      setApprovals((prev) => prev.filter((a) => a.id !== oldRecord.id));
    }, []),
  });

  // Summary stats
  const pendingCount = approvals.filter((a) => a.status === "pending").length;
  const approvedCount = approvals.filter((a) => a.status === "approved").length;
  const rejectedCount = approvals.filter((a) => a.status === "rejected").length;

  // Pagination
  const totalPages = Math.ceil(approvals.length / pageSize);
  const paginatedApprovals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return approvals.slice(start, start + pageSize);
  }, [approvals, currentPage, pageSize]);

  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1); // Reset to first page
    setSelectedIds(new Set()); // Clear selection
  }, []);

  const fetchApprovals = useCallback(
    async (filters: {
      status?: string;
      priority?: string;
      search?: string;
      connectionId?: string;
      source?: string;
      showArchived?: boolean;
    }) => {
      setIsFetching(true);
      try {
        const supabase = createClient();
        let query = supabase
          .from("approval_requests")
          .select("*")
          .order("status", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(50);

        if (filters.showArchived) {
          query = query.not("archived_at", "is", null);
        } else {
          query = query.is("archived_at", null);
        }
        if (filters.status) query = query.eq("status", filters.status);
        if (filters.priority) query = query.eq("priority", filters.priority);
        if (filters.search) query = query.ilike("title", `%${filters.search}%`);
        if (filters.connectionId) query = query.eq("connection_id", filters.connectionId);
        if (filters.source) query = query.eq("source", filters.source);

        const { data, error } = await query;
        if (error) { toast.error("Failed to fetch approvals"); return; }
        setApprovals(data ?? []);
      } catch {
        toast.error("Failed to fetch approvals");
      } finally {
        setIsFetching(false);
      }
    },
    []
  );

  const handleFilterChange = useCallback(
    (filters: {
      status?: string;
      priority?: string;
      search?: string;
      connectionId?: string;
      source?: string;
      showArchived?: boolean;
    }) => {
      setStatus(filters.status);
      setPriority(filters.priority);
      setSearch(filters.search ?? "");
      setSource(filters.source);
      if (filters.showArchived !== undefined) setShowArchived(filters.showArchived);
      setCurrentPage(1); // Reset to first page when filters change
      fetchApprovals(filters);
    },
    [fetchApprovals, setStatus, setPriority, setSearch, setSource, setShowArchived]
  );

  const handleRefresh = useCallback(() => {
    fetchApprovals({ status, priority, search, source, showArchived });
  }, [fetchApprovals, status, priority, search, source, showArchived]);

  // Stat card click-to-filter
  const handleStatClick = useCallback((filterStatus: string | undefined) => {
    handleFilterChange({ status: filterStatus, priority, search, source, showArchived });
  }, [handleFilterChange, priority, search, source, showArchived]);

  const handleSelect = useCallback((approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    if (layout !== "split") {
      setDetailOpen(true);
    }
  }, [layout]);

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false);
    setSelectedApproval(null);
  }, []);

  const submitDecision = useCallback(
    async (
      approvalId: string,
      decision: "approved" | "rejected",
      comment?: string,
    ) => {
      // Optimistic update: apply decision immediately in local state
      const optimisticUpdate = {
        status: decision,
        decided_at: new Date().toISOString(),
        decision_comment: comment || null,
        decision_source: "dashboard" as const,
      };

      // Snapshot current state for rollback
      const previousApprovals = approvals;
      const previousSelected = selectedApproval;

      setApprovals((prev) =>
        prev.map((a) =>
          a.id === approvalId ? { ...a, ...optimisticUpdate } : a
        )
      );
      setSelectedApproval((prev) =>
        prev?.id === approvalId ? { ...prev, ...optimisticUpdate } : prev
      );

      toast.success(
        decision === "approved"
          ? "Request approved successfully"
          : "Request rejected"
      );

      if (layout !== "split") {
        handleCloseDetail();
      }

      // Fire the API call in the background
      try {
        const response = await fetch(`/api/v1/approvals/${approvalId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: decision === "approved" ? "approve" : "reject",
            comment: comment || undefined,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          throw new Error(
            errorData?.error ?? `Request failed with status ${response.status}`
          );
        }

        // Apply the real server response to get accurate timestamps etc.
        const updatedApproval = await response.json();
        setApprovals((prev) =>
          prev.map((a) =>
            a.id === approvalId ? { ...a, ...updatedApproval } : a
          )
        );
        setSelectedApproval((prev) =>
          prev?.id === approvalId ? { ...prev, ...updatedApproval } : prev
        );
      } catch (err) {
        // Revert optimistic update on failure
        setApprovals(previousApprovals);
        setSelectedApproval(previousSelected);
        toast.error(
          err instanceof Error ? err.message : "Failed to submit decision"
        );
      }
    },
    [handleCloseDetail, layout, approvals, selectedApproval]
  );

  const handleRespond = useCallback(
    async (
      approvalId: string,
      decision: "approved" | "rejected",
      comment: string
    ) => {
      await submitDecision(approvalId, decision, comment);
    },
    [submitDecision]
  );

  const handleInlineAction = useCallback(
    async (approvalId: string, decision: "approved" | "rejected", comment?: string) => {
      await submitDecision(approvalId, decision, comment);
    },
    [submitDecision]
  );

  const handleSkipConfirmationChange = useCallback(async (skip: boolean) => {
    setSkipConfirmation(skip);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notification_settings")
      .upsert({
        user_id: user.id,
        skip_approval_confirmation: skip,
      }, { onConflict: "user_id" });
  }, []);

  // ---- Selection handlers ---------------------------------------------------

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === approvals.length
        ? new Set()
        : new Set(approvals.map((a) => a.id))
    );
  }, [approvals]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // Clear selection when filters change or data refreshes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [status, priority, search, source, showArchived]);

  // ---- Batch archive -------------------------------------------------------

  const handleBatchArchive = useCallback(async () => {
    const ids = [...selectedIds];
    const previousApprovals = approvals;

    // Optimistic: remove from local list (unless showing archived)
    if (!showArchived) {
      setApprovals((prev) => prev.filter((a) => !selectedIds.has(a.id)));
    }
    clearSelection();

    try {
      const res = await fetch("/api/v1/approvals/batch/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "archive" }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      const result = await res.json();
      toast.success(`Archived ${result.processed} request(s)`);
      if (showArchived) handleRefresh();
    } catch {
      setApprovals(previousApprovals);
      toast.error("Failed to archive requests");
    }
  }, [selectedIds, approvals, showArchived, clearSelection, handleRefresh]);

  const handleBatchUnarchive = useCallback(async () => {
    const ids = [...selectedIds];
    clearSelection();

    try {
      const res = await fetch("/api/v1/approvals/batch/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "unarchive" }),
      });
      if (!res.ok) throw new Error("Failed to unarchive");
      const result = await res.json();
      toast.success(`Unarchived ${result.processed} request(s)`);
      handleRefresh();
    } catch {
      toast.error("Failed to unarchive requests");
    }
  }, [selectedIds, clearSelection, handleRefresh]);

  const handleBatchAction = useCallback(
    (decision: "approve" | "reject") => {
      clearSelection();
      handleRefresh();
    },
    [clearSelection, handleRefresh]
  );

  // ---- Flow config dialog ---------------------------------------------------

  const [flowConfigApproval, setFlowConfigApproval] = useState<ApprovalRequest | null>(null);

  const handleConfigureFlow = useCallback((approval: ApprovalRequest) => {
    setFlowConfigApproval(approval);
  }, []);

  const handleCloseFlowConfig = useCallback(() => {
    setFlowConfigApproval(null);
  }, []);

  // ---- Single archive/unarchive (from card menu) ---------------------------

  const handleSingleArchive = useCallback(async (approvalId: string) => {
    const previousApprovals = approvals;
    if (!showArchived) {
      setApprovals((prev) => prev.filter((a) => a.id !== approvalId));
    }

    try {
      const res = await fetch("/api/v1/approvals/batch/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [approvalId], action: "archive" }),
      });
      if (!res.ok) throw new Error("Failed to archive");
      toast.success("Request archived");
      if (showArchived) handleRefresh();
    } catch {
      setApprovals(previousApprovals);
      toast.error("Failed to archive request");
    }
  }, [approvals, showArchived, handleRefresh]);

  const handleSingleUnarchive = useCallback(async (approvalId: string) => {
    try {
      const res = await fetch("/api/v1/approvals/batch/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [approvalId], action: "unarchive" }),
      });
      if (!res.ok) throw new Error("Failed to unarchive");
      toast.success("Request unarchived");
      handleRefresh();
    } catch {
      toast.error("Failed to unarchive request");
    }
  }, [handleRefresh]);

  // Check if any selected items are archived (for showing unarchive button)
  const hasArchivedSelected = useMemo(
    () => [...selectedIds].some((id) => approvals.find((a) => a.id === id)?.archived_at),
    [selectedIds, approvals]
  );

  // Merge server-provided creator names with client-resolved ones (for realtime inserts)
  const allCreatorNames = useMemo(() => {
    const merged: Record<string, string> = { ...approvalCreators };
    for (const a of approvals) {
      if (!merged[a.id] && a.created_by?.user_id) {
        const profile = userProfiles.get(a.created_by.user_id);
        if (profile) {
          merged[a.id] = profile.full_name || profile.email;
        }
      }
    }
    return merged;
  }, [approvalCreators, approvals, userProfiles]);

  const sharedListProps = {
    approvals: paginatedApprovals,
    connections,
    approvalCreators: allCreatorNames,
    onSelect: handleSelect,
    canApprove,
    isLoading,
    skipConfirmation,
    onInlineAction: handleInlineAction,
    onSkipConfirmationChange: handleSkipConfirmationChange,
    newIds,
    selectedIds,
    onToggleSelect: toggleSelect,
    onArchive: handleSingleArchive,
    onUnarchive: handleSingleUnarchive,
    onConfigureFlow: handleConfigureFlow,
  };

  return (
    <div className={`space-y-8 ${selectedIds.size > 0 ? "pb-20" : ""}`}>
      {/* Header row: live indicator + refresh + layout toggle */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isFetching}
            className="h-8 gap-1.5 text-xs text-muted-foreground"
          >
            <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <LayoutToggle layout={layout} onChange={handleLayoutChange} />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard
          title="Pending"
          value={pendingCount}
          icon={Clock}
          iconColor="text-amber-500"
          subtitle="Awaiting decision"
          onClick={() => handleStatClick(status === "pending" ? undefined : "pending")}
          className={status === "pending" ? "ring-2 ring-amber-400/50" : ""}
        />
        <StatCard
          title="Approved"
          value={approvedCount}
          icon={CheckCircle}
          iconColor="text-emerald-500"
          subtitle="Recently approved"
          onClick={() => handleStatClick(status === "approved" ? undefined : "approved")}
          className={status === "approved" ? "ring-2 ring-emerald-400/50" : ""}
        />
        <StatCard
          title="Rejected"
          value={rejectedCount}
          icon={XCircle}
          iconColor="text-red-500"
          subtitle="Recently rejected"
          onClick={() => handleStatClick(status === "rejected" ? undefined : "rejected")}
          className={status === "rejected" ? "ring-2 ring-red-400/50" : ""}
        />
      </div>

      {/* Filters */}
      <ApprovalFilters
        onFilterChange={handleFilterChange}
        connections={connections}
        currentFilters={{ status, priority, search, source, showArchived }}
      />

      {/* Select all bar */}
      {approvals.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <Checkbox
            checked={selectedIds.size === approvals.length && approvals.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-xs text-muted-foreground">
            {selectedIds.size > 0
              ? `${selectedIds.size} of ${approvals.length} selected`
              : "Select all"}
          </span>
        </div>
      )}

      {/* Archived empty state */}
      {showArchived && approvals.length === 0 && !isFetching && (
        <EmptyState
          icon={Archive}
          title="No archived requests"
          description="Requests you archive will appear here. Select requests and click Archive to move them out of your main view."
        />
      )}

      {/* Approval list — conditional by layout */}
      <div className={isFetching ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
        {!showArchived || approvals.length > 0 ? (
          <>
            {layout === "cards" && <ApprovalList {...sharedListProps} />}
            {layout === "grouped" && <ApprovalListGrouped {...sharedListProps} />}
            {layout === "split" && (
              <ApprovalListMasterDetail
                {...sharedListProps}
                onRespond={handleRespond}
                userProfiles={userProfiles}
              />
            )}
          </>
        ) : null}
      </div>

      {/* Pagination */}
      {approvals.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={approvals.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      )}

      {/* Detail slide-in panel (Cards & Grouped only) */}
      {layout !== "split" && (
        <ApprovalDetail
          approval={selectedApproval}
          open={detailOpen}
          onClose={handleCloseDetail}
          onRespond={handleRespond}
          isLoading={isLoading}
          canApprove={canApprove}
          userProfiles={userProfiles}
        />
      )}

      {/* Batch actions bar */}
      <BatchActionsBar
        selectedIds={[...selectedIds]}
        onClear={clearSelection}
        onBatchAction={handleBatchAction}
        onArchive={handleBatchArchive}
        onUnarchive={hasArchivedSelected ? handleBatchUnarchive : undefined}
      />

      {/* Flow config dialog */}
      <FlowConfigDialog
        approval={flowConfigApproval}
        open={flowConfigApproval !== null}
        onClose={handleCloseFlowConfig}
        orgId={orgId}
      />
    </div>
  );
}
