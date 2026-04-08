"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ApprovalFilters } from "@/components/approvals/approval-filters";
import { ApprovalListGrouped } from "@/components/approvals/approval-list-grouped";
import { ApprovalDetail } from "@/components/approvals/approval-detail";
import { Pagination } from "@/components/ui/pagination";
import { useApprovalFiltersStore } from "@/stores/approval-filters-store";
import { useRealtime } from "@/hooks/use-realtime";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle, RefreshCw, Archive, Download, AlertTriangle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { BatchActionsBar } from "@/components/approvals/batch-actions-bar";
import { FlowConfigDialog } from "@/components/approvals/flow-config-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { ApprovalRequest, ApprovalComment, Connection, UserProfile } from "@/lib/types/database";
import { useOnboardingTourStore } from "@/stores/onboarding-tour-store";

interface ApprovalDashboardProps {
  initialApprovals?: ApprovalRequest[];
  connections?: Connection[];
  approvalCreators?: Record<string, string>;
  teamsMap?: Record<string, string>;
  canApprove?: boolean;
  orgId: string;
  userId: string;
  userRole: string;
}

export function ApprovalDashboard({
  initialApprovals,
  connections: initialConnections,
  approvalCreators = {},
  teamsMap = {},
  canApprove = true,
  orgId,
  userId,
  userRole,
}: ApprovalDashboardProps) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(initialApprovals ?? []);
  const [connections, setConnections] = useState<Connection[]>(initialConnections ?? []);
  const [commentsMap, setCommentsMap] = useState<Record<string, ApprovalComment[]>>({});
  const [selectedApproval, setSelectedApproval] = useState<ApprovalRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(!initialApprovals);
  const [initialLoadDone, setInitialLoadDone] = useState(!!initialApprovals);
  const [skipConfirmation, setSkipConfirmation] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const newIdTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [usageInfo, setUsageInfo] = useState<{
    plan: string;
    requestsUsed: number;
    requestsLimit: number;
    limitReached: boolean;
    nearLimit: boolean;
  } | null>(null);

  const { status, priority, search, source, showArchived, setStatus, setPriority, setSearch, setSource, setShowArchived } =
    useApprovalFiltersStore();

  // Collect all user IDs referenced in approvals (+ connection owners) and fetch their profiles
  const referencedUserIds = useMemo(() => {
    const ids = new Set<string>();
    for (const a of approvals) {
      if (a.decided_by) ids.add(a.decided_by);
      if (a.assigned_approvers) {
        for (const id of a.assigned_approvers) ids.add(id);
      }
      if (a.created_by?.user_id) ids.add(a.created_by.user_id);
      // Also include connection owner for API key requests without user_id
      if (a.created_by?.connection_id && !a.created_by.user_id) {
        const conn = connections.find((c) => c.id === a.created_by?.connection_id);
        if (conn?.created_by) ids.add(conn.created_by);
      }
    }
    return ids;
  }, [approvals, connections]);

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

  // Fetch data client-side on mount when no initial data was provided from the server.
  // This avoids passing large approval payloads through the RSC protocol which can
  // stall client-side navigation in Next.js.
  useEffect(() => {
    if (initialApprovals) return; // Server already provided the data

    const loadInitialData = async () => {
      setIsFetching(true);
      try {
        const supabase = createClient();
        const [{ data: approvalsData }, { data: connectionsData }] = await Promise.all([
          supabase
            .from("approval_requests")
            .select("id, title, description, status, priority, action_type, source, connection_id, created_by, decided_by, assigned_approvers, assigned_team_id, flow_id, created_at, decided_at, expires_at, archived_at, required_approvals, idempotency_key, callback_url, is_log")
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(50),
          supabase
            .from("connections")
            .select("id, name, is_active, api_key_prefix, last_used_at, created_by, created_at")
            .order("name"),
        ]);
        const loadedApprovals = (approvalsData ?? []) as unknown as ApprovalRequest[];
        const loadedConnections = (connectionsData ?? []) as unknown as Connection[];
        setApprovals(loadedApprovals);
        setConnections(loadedConnections);

        // Eagerly fetch creator profiles (connection owners) so names show immediately
        const creatorIds = new Set<string>();
        for (const a of loadedApprovals) {
          if (a.created_by?.user_id) {
            creatorIds.add(a.created_by.user_id);
          } else if (a.created_by?.connection_id) {
            const conn = loadedConnections.find((c) => c.id === a.created_by?.connection_id);
            if (conn?.created_by) creatorIds.add(conn.created_by);
          }
          if (a.decided_by) creatorIds.add(a.decided_by);
          if (a.assigned_approvers) {
            for (const id of a.assigned_approvers) creatorIds.add(id);
          }
        }
        if (creatorIds.size > 0) {
          const { data: profileData } = await supabase
            .from("user_profiles")
            .select("id, email, full_name, avatar_url")
            .in("id", [...creatorIds]);
          if (profileData && profileData.length > 0) {
            setUserProfiles((prev) => {
              const next = new Map(prev);
              for (const p of profileData) {
                next.set(p.id, p as UserProfile);
              }
              return next;
            });
          }
        }
      } catch {
        toast.error("Failed to load approvals");
      } finally {
        setIsFetching(false);
        setInitialLoadDone(true);
      }
    };
    loadInitialData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch comments for all loaded approvals
  useEffect(() => {
    if (approvals.length === 0) return;

    const fetchComments = async () => {
      const supabase = createClient();
      const ids = approvals.map((a) => a.id);
      const { data: allComments } = await supabase
        .from("approval_comments")
        .select("*")
        .in("request_id", ids)
        .order("created_at", { ascending: true });
      if (allComments) {
        const grouped: Record<string, ApprovalComment[]> = {};
        for (const c of allComments) {
          (grouped[c.request_id] ??= []).push(c as ApprovalComment);
        }
        setCommentsMap(grouped);
      }
    };

    fetchComments();
  }, [approvals]);

  // Load preferences from notification_settings
  useEffect(() => {
    const loadPreferences = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notification_settings")
        .select("skip_approval_confirmation")
        .eq("user_id", user.id)
        .single();

      if (data?.skip_approval_confirmation) {
        setSkipConfirmation(true);
      }
    };
    loadPreferences();
  }, []);

  // NOTE: Notifications are marked as read when the user clicks them
  // in the notification panel, not automatically on page mount.

  // Fetch usage/billing info to show limit banner
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch("/api/v1/billing/usage");
        if (!res.ok) return;
        const data = await res.json();
        const limit = data.limits?.maxRequests ?? -1;
        const used = data.usage?.requests ?? 0;
        if (limit === -1) return; // unlimited plan, no banner needed
        setUsageInfo({
          plan: data.plan,
          requestsUsed: used,
          requestsLimit: limit,
          limitReached: used >= limit,
          nearLimit: used >= limit * 0.8 && used < limit,
        });
      } catch {
        // Silently fail. Banner is non-critical.
      }
    };
    fetchUsage();
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
      // Notify sidebar for optimistic update sync
      window.dispatchEvent(new CustomEvent("approval-realtime", { detail: { type: "INSERT", record } }));
    }, [markAsNew]),
    onUpdate: useCallback((record: ApprovalRequest, oldRecord: ApprovalRequest) => {
      setApprovals((prev) =>
        prev.map((a) => (a.id === record.id ? record : a))
      );
      setSelectedApproval((prev) =>
        prev?.id === record.id ? record : prev
      );
      window.dispatchEvent(new CustomEvent("approval-realtime", { detail: { type: "UPDATE", record, oldRecord } }));
    }, []),
    onDelete: useCallback((oldRecord: ApprovalRequest) => {
      setApprovals((prev) => prev.filter((a) => a.id !== oldRecord.id));
      window.dispatchEvent(new CustomEvent("approval-realtime", { detail: { type: "DELETE", record: oldRecord } }));
    }, []),
  });

  // Realtime: listen for new/deleted comments across all approvals
  useRealtime<ApprovalComment>({
    table: "approval_comments",
    onInsert: useCallback((record: ApprovalComment) => {
      setCommentsMap((prev) => {
        const existing = prev[record.request_id] ?? [];
        if (existing.some((c) => c.id === record.id)) return prev;
        return { ...prev, [record.request_id]: [...existing, record] };
      });
    }, []),
    onDelete: useCallback((oldRecord: ApprovalComment) => {
      setCommentsMap((prev) => {
        const existing = prev[oldRecord.request_id];
        if (!existing) return prev;
        return { ...prev, [oldRecord.request_id]: existing.filter((c) => c.id !== oldRecord.id) };
      });
    }, []),
  });

  // Summary stats
  const pendingCount = approvals.filter((a) => a.status === "pending").length;
  const approvedCount = approvals.filter((a) => a.status === "approved").length;
  const rejectedCount = approvals.filter((a) => a.status === "rejected").length;

  // Sort: pending first, then resolved. Both within page size limit.
  const sortedApprovals = useMemo(() => {
    const pending = approvals.filter((a) => a.status === "pending");
    const resolved = approvals.filter((a) => a.status !== "pending");
    return [...pending, ...resolved];
  }, [approvals]);

  // Pagination applies to the full sorted list
  const totalPages = Math.ceil(sortedApprovals.length / pageSize);
  const paginatedApprovals = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedApprovals.slice(start, start + pageSize);
  }, [sortedApprovals, currentPage, pageSize]);

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
        if (filters.search) {
          const escaped = filters.search.replace(/[%_\\]/g, "\\$&");
          query = query.ilike("title", `%${escaped}%`);
        }
        if (filters.connectionId) query = query.eq("connection_id", filters.connectionId);
        if (filters.source) query = query.eq("source", filters.source);

        const { data, error } = await query;
        if (error) { toast.error("Failed to fetch approvals"); return; }
        setApprovals(data ?? []);

        // Batch-fetch comments for all loaded approvals
        if (data && data.length > 0) {
          const ids = data.map((a: ApprovalRequest) => a.id);
          const { data: allComments } = await supabase
            .from("approval_comments")
            .select("*")
            .in("request_id", ids)
            .order("created_at", { ascending: true });
          if (allComments) {
            const grouped: Record<string, ApprovalComment[]> = {};
            for (const c of allComments) {
              (grouped[c.request_id] ??= []).push(c);
            }
            setCommentsMap(grouped);
          }
        }
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

  // Auto-open detail panel from ?open=<id> query param (e.g. from notification click)
  const searchParams = useSearchParams();
  const router = useRouter();
  const openRequestId = searchParams.get("open");
  const handledOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (!openRequestId || handledOpenRef.current === openRequestId) return;
    const target = approvals.find((a) => a.id === openRequestId);
    if (target) {
      handledOpenRef.current = openRequestId;
      setSelectedApproval(target);
      setDetailOpen(true);
      // Clean up the URL without triggering a navigation
      router.replace("/requests", { scroll: false });
    }
  }, [openRequestId, approvals, router]);

  const handleSelect = useCallback((approval: ApprovalRequest) => {
    setSelectedApproval(approval);
    setDetailOpen(true);
  }, []);

  // Tour step 5: auto-open detail panel for the test request
  const tourActivePageId = useOnboardingTourStore((s) => s.activePageId);
  const tourStepIndex = useOnboardingTourStore((s) => s.currentStepInPage);
  const isTourOnDetailStep = tourActivePageId === "requests" && tourStepIndex === 4;
  useEffect(() => {
    if (isTourOnDetailStep) {
      const testRequest = approvals.find((a) => a.source === "onboarding");
      if (testRequest && !detailOpen) {
        setSelectedApproval(testRequest);
        setDetailOpen(true);
      }
    }
  }, [isTourOnDetailStep, approvals, detailOpen]);

  // Close detail panel when tour leaves step 5 (user clicked X, Skip, or Done)
  const prevTourOnDetailStep = useRef(false);
  useEffect(() => {
    if (prevTourOnDetailStep.current && !isTourOnDetailStep && detailOpen) {
      setDetailOpen(false);
      setSelectedApproval(null);
    }
    prevTourOnDetailStep.current = isTourOnDetailStep;
  }, [isTourOnDetailStep, detailOpen]);

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

      // Notify sidebar immediately so the badge count updates without waiting
      // for the realtime event from the optimistic update.
      const oldRecord = approvals.find((a) => a.id === approvalId);
      if (oldRecord) {
        window.dispatchEvent(
          new CustomEvent("approval-realtime", {
            detail: {
              type: "UPDATE",
              record: { ...oldRecord, ...optimisticUpdate },
              oldRecord,
            },
          })
        );
      }

      handleCloseDetail();

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
    [handleCloseDetail, approvals, selectedApproval]
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
    const pageIds = paginatedApprovals.map((a) => a.id);
    setSelectedIds((prev) => {
      const allPageSelected = pageIds.every((id) => prev.has(id));
      if (allPageSelected) {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...pageIds]);
    });
  }, [paginatedApprovals]);

  const toggleSelectSection = useCallback((sectionIds: string[]) => {
    setSelectedIds((prev) => {
      const allSelected = sectionIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        sectionIds.forEach((id) => next.delete(id));
      } else {
        sectionIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, []);

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
  // Also resolve connection owners for API key requests missing user_id
  const allCreatorNames = useMemo(() => {
    const merged: Record<string, string> = { ...approvalCreators };
    for (const a of approvals) {
      if (merged[a.id]) continue;
      // Try direct user_id on created_by
      if (a.created_by?.user_id) {
        const profile = userProfiles.get(a.created_by.user_id);
        if (profile) {
          merged[a.id] = profile.full_name || profile.email;
          continue;
        }
      }
      // Fallback: look up who created the connection
      if (a.created_by?.connection_id) {
        const conn = connections.find((c) => c.id === a.created_by?.connection_id);
        if (conn?.created_by) {
          const profile = userProfiles.get(conn.created_by);
          if (profile) {
            merged[a.id] = profile.full_name || profile.email;
          }
        }
      }
    }
    return merged;
  }, [approvalCreators, approvals, userProfiles, connections]);

  const sharedListProps = {
    approvals: paginatedApprovals,
    connections,
    approvalCreators: allCreatorNames,
    teamsMap,
    userProfiles,
    onSelect: handleSelect,
    canApprove,
    isLoading,
    skipConfirmation,
    onInlineAction: handleInlineAction,
    onSkipConfirmationChange: handleSkipConfirmationChange,
    newIds,
    selectedIds,
    onToggleSelect: toggleSelect,
    onToggleSelectSection: toggleSelectSection,
    onArchive: handleSingleArchive,
    onUnarchive: handleSingleUnarchive,
    onConfigureFlow: handleConfigureFlow,
  };

  // Show skeleton while loading initial data client-side
  if (!initialLoadDone) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-[80px] rounded-full" />
            <Skeleton className="h-7 w-[80px] rounded-full" />
            <Skeleton className="h-7 w-[80px] rounded-full" />
          </div>
          <Skeleton className="h-7 w-[100px]" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-[130px]" />
          <Skeleton className="h-9 w-[130px]" />
          <Skeleton className="h-9 w-[150px]" />
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border-0 border-l-4 border-l-zinc-200 p-0 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-[240px]" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-[60px]" />
                    <Skeleton className="h-3 w-[80px]" />
                    <Skeleton className="h-3 w-[70px]" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${selectedIds.size > 0 ? "pb-20" : ""}`}>
      {/* Usage limit banner */}
      {usageInfo?.limitReached && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              Monthly request limit reached ({usageInfo.requestsUsed}/{usageInfo.requestsLimit})
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">
              New API requests will be rejected until the limit resets next month. Upgrade to Pro for unlimited requests.
            </p>
          </div>
          <Button size="sm" className="shrink-0 gap-1.5" asChild>
            <a href="/org/subscription">
              Upgrade
              <ArrowUpRight className="size-3.5" />
            </a>
          </Button>
        </div>
      )}
      {usageInfo?.nearLimit && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/20">
          <AlertTriangle className="size-4 shrink-0 text-amber-500" />
          <p className="flex-1 text-sm text-amber-800 dark:text-amber-300">
            Approaching request limit: {usageInfo.requestsUsed}/{usageInfo.requestsLimit} used this month.{" "}
            <a href="/org/subscription" className="font-medium underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200">
              Upgrade for unlimited
            </a>
          </p>
        </div>
      )}

      {/* Live indicator + refresh + export */}
      <div className="flex items-center justify-end gap-2">
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
          className="h-7 gap-1.5 text-xs text-muted-foreground"
        >
          <RefreshCw className={cn("size-3.5", isFetching && "animate-spin")} />
          Refresh
        </Button>
        {approvals.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs shrink-0"
            onClick={() => {
              const headers = ["ID", "Title", "Status", "Priority", "Action Type", "Source", "Created", "Decided"];
              const rows = approvals.map((a) => [
                a.id,
                `"${(a.title ?? "").replace(/"/g, '""')}"`,
                a.status,
                a.priority,
                a.action_type ?? "",
                a.source ?? "",
                a.created_at,
                a.decided_at ?? "",
              ]);
              const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
              const blob = new Blob([csv], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `okrunit-approvals-${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success("Exported to CSV");
            }}
          >
            <Download className="size-3.5" />
            Export
          </Button>
        )}
      </div>

      {/* Filters */}
      <ApprovalFilters
        onFilterChange={handleFilterChange}
        connections={connections}
        currentFilters={{ status, priority, search, source, showArchived }}
      />

      {/* Select all bar */}
      {paginatedApprovals.length > 0 && (
        <div className="flex items-center gap-2 px-4">
          <Checkbox
            checked={paginatedApprovals.every((a) => selectedIds.has(a.id)) && paginatedApprovals.length > 0}
            onCheckedChange={toggleSelectAll}
            className="bg-white dark:bg-zinc-900"
          />
          <span className="text-xs text-muted-foreground">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `Select all on this page (${paginatedApprovals.length})`}
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

      {/* Approval list - always grouped */}
      <div className={isFetching ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
        {(!showArchived || approvals.length > 0) && (
          <ApprovalListGrouped {...sharedListProps} />
        )}
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

      {/* Detail slide-in panel */}
      <ApprovalDetail
        approval={selectedApproval}
        open={detailOpen}
        onClose={handleCloseDetail}
        onRespond={handleRespond}
        isLoading={isLoading}
        canApprove={canApprove}
        userProfiles={userProfiles}
        creatorName={selectedApproval ? allCreatorNames[selectedApproval.id] : undefined}
        onConfigureFlow={handleConfigureFlow}
        initialComments={selectedApproval ? commentsMap[selectedApproval.id] ?? [] : []}
        onCommentsChange={(approvalId, comments) => {
          setCommentsMap((prev) => ({ ...prev, [approvalId]: comments }));
        }}
        currentUserId={userId}
        currentUserRole={userRole}
      />

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
