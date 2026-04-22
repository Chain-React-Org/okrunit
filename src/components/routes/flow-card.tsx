"use client";

import { useState, useCallback, useEffect, memo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow, differenceInDays } from "date-fns";
import {
  ChevronDown,
  ChevronUp,
  Check,
  ExternalLink,
  Settings2,
  Users,
  UserCheck,
  Shield,
  X,
  ArrowRight,
  Plus,
  Loader2,
  Info,
  Archive,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
import { SOURCE_CONFIG } from "@/components/approvals/source-icons";
import { cn } from "@/lib/utils";
import type { ApprovalFlow, ApproverMode, UserRole } from "@/lib/types/database";
import type { TeamOption, MemberOption } from "@/components/routes/routes-hub";

// UI-level approver mode. "by_position" maps to "designated" + assigned_team_id on save.
type UIApproverMode = ApproverMode | "by_position";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATION_PRESETS = [
  { label: "Next request only", value: "1" },
  { label: "Next 5 requests", value: "5" },
  { label: "Next 25 requests", value: "25" },
  { label: "Next 100 requests", value: "100" },
  { label: "Always (forever)", value: "forever" },
  { label: "Custom...", value: "custom" },
] as const;

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: "Member (anyone)", value: "member" },
  { label: "Admin or higher", value: "admin" },
  { label: "Owner only", value: "owner" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FieldLabel({ children, tooltip }: { children: React.ReactNode; tooltip: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label className="text-xs">{children}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info className="size-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-[260px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FlowCardProps {
  flow: ApprovalFlow;
  teams: TeamOption[];
  members: MemberOption[];
  orgId: string;
  positionsMap?: Record<string, string>;
  onDelete?: (flowId: string) => void;
}

// Draft state shape for sessionStorage persistence
interface FlowDraft {
  flowName: string;
  sourceUrl: string;
  approverMode: UIApproverMode;
  selectedApprovers: string[];
  selectedTeamId: string;
  requiredRole: string;
  isSequential: boolean;
  requiredApprovals: number;
  durationPreset: string;
  customCount: string;
  selectedPositionId: string;
}

function getDraftKey(flowId: string) {
  return `okrunit:flow-draft:${flowId}`;
}

function loadDraft(flowId: string): FlowDraft | null {
  try {
    const raw = sessionStorage.getItem(getDraftKey(flowId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(flowId: string, draft: FlowDraft) {
  try {
    sessionStorage.setItem(getDraftKey(flowId), JSON.stringify(draft));
  } catch {
    // sessionStorage full or unavailable. Ignore.
  }
}

function clearDraft(flowId: string) {
  try {
    sessionStorage.removeItem(getDraftKey(flowId));
  } catch {
    // ignore
  }
}

export const FlowCard = memo(function FlowCard({ flow, teams, members, orgId, positionsMap, onDelete }: FlowCardProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Stale detection: no activity in 30+ days
  const daysSinceLastRequest = flow.last_request_at
    ? differenceInDays(new Date(), new Date(flow.last_request_at))
    : flow.created_at
      ? differenceInDays(new Date(), new Date(flow.created_at))
      : 0;
  const isStale = daysSinceLastRequest >= 30;

  // Compute initial values from flow (used for both fresh init and dirty detection)
  const initialUIMode: UIApproverMode =
    flow.approver_mode === "designated" &&
    flow.assigned_team_id &&
    (!flow.assigned_approvers || flow.assigned_approvers.length === 0)
      ? "by_position"
      : flow.approver_mode || "any";

  const initialDurationPreset = (() => {
    if (flow.apply_for_next === null) return "forever";
    const match = DURATION_PRESETS.find(
      (p) => p.value !== "forever" && p.value !== "custom" && Number(p.value) === flow.apply_for_next,
    );
    return match ? match.value : "custom";
  })();

  const initialCustomCount = (() => {
    if (flow.apply_for_next === null) return "";
    const match = DURATION_PRESETS.find(
      (p) => p.value !== "forever" && p.value !== "custom" && Number(p.value) === flow.apply_for_next,
    );
    return match ? "" : String(flow.apply_for_next);
  })();

  // Check for saved draft on mount
  const draft = loadDraft(flow.id);

  // Flow name & source URL (editable)
  const [flowName, setFlowName] = useState(draft?.flowName ?? flow.name ?? "");
  const [sourceUrl, setSourceUrl] = useState(draft?.sourceUrl ?? flow.source_url ?? "");

  // Form state
  const [approverMode, setApproverMode] = useState<UIApproverMode>(draft?.approverMode ?? initialUIMode);
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>(draft?.selectedApprovers ?? flow.assigned_approvers ?? []);
  const [selectedTeamId, setSelectedTeamId] = useState(draft?.selectedTeamId ?? flow.assigned_team_id ?? "none");
  const [requiredRole, setRequiredRole] = useState<UserRole | "none">((draft?.requiredRole as UserRole | "none") ?? flow.required_role ?? "none");
  const [isSequential, setIsSequential] = useState(draft?.isSequential ?? flow.is_sequential ?? false);
  const [requiredApprovals, setRequiredApprovals] = useState(draft?.requiredApprovals ?? flow.default_required_approvals ?? 1);
  const [durationPreset, setDurationPreset] = useState<string>(draft?.durationPreset ?? initialDurationPreset);
  const [customCount, setCustomCount] = useState(draft?.customCount ?? initialCustomCount);

  // Position state (for by_position mode)
  const [selectedPositionId, setSelectedPositionId] = useState(draft?.selectedPositionId ?? flow.assigned_position_id ?? "none");
  const [positions, setPositions] = useState<{ id: string; name: string }[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const [creatingPosition, setCreatingPosition] = useState(false);

  // Show restored draft toast on mount (once)
  useEffect(() => {
    if (draft && !restoredDraft) {
      setRestoredDraft(true);
      setExpanded(true);
      toast("Restored unsaved changes", {
        description: "Your previous edits to this flow were recovered.",
        action: {
          label: "Discard",
          onClick: () => {
            clearDraft(flow.id);
            // Reset all fields to flow values
            setFlowName(flow.name ?? "");
            setSourceUrl(flow.source_url ?? "");
            setApproverMode(initialUIMode);
            setSelectedApprovers(flow.assigned_approvers ?? []);
            setSelectedTeamId(flow.assigned_team_id ?? "none");
            setRequiredRole(flow.required_role ?? "none");
            setIsSequential(flow.is_sequential ?? false);
            setRequiredApprovals(flow.default_required_approvals ?? 1);
            setDurationPreset(initialDurationPreset);
            setCustomCount(initialCustomCount);
            setSelectedPositionId(flow.assigned_position_id ?? "none");
            toast.success("Draft discarded");
          },
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect dirty state (any field differs from saved flow)
  const isDirty =
    flowName !== (flow.name ?? "") ||
    sourceUrl !== (flow.source_url ?? "") ||
    approverMode !== initialUIMode ||
    JSON.stringify(selectedApprovers) !== JSON.stringify(flow.assigned_approvers ?? []) ||
    selectedTeamId !== (flow.assigned_team_id ?? "none") ||
    requiredRole !== (flow.required_role ?? "none") ||
    isSequential !== (flow.is_sequential ?? false) ||
    requiredApprovals !== (flow.default_required_approvals ?? 1) ||
    durationPreset !== initialDurationPreset ||
    customCount !== initialCustomCount ||
    selectedPositionId !== (flow.assigned_position_id ?? "none");

  // Save draft to sessionStorage on every change
  useEffect(() => {
    if (isDirty) {
      saveDraft(flow.id, {
        flowName,
        sourceUrl,
        approverMode,
        selectedApprovers,
        selectedTeamId,
        requiredRole,
        isSequential,
        requiredApprovals,
        durationPreset,
        customCount,
        selectedPositionId,
      });
    } else {
      clearDraft(flow.id);
    }
  }, [flow.id, isDirty, flowName, sourceUrl, approverMode, selectedApprovers, selectedTeamId, requiredRole, isSequential, requiredApprovals, durationPreset, customCount, selectedPositionId]);

  // Warn on tab close / hard navigation when dirty
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  useEffect(() => {
    if (approverMode !== "by_position" || selectedTeamId === "none") {
      setPositions([]);
      return;
    }
    setLoadingPositions(true);
    fetch(`/api/v1/teams/${selectedTeamId}/positions`)
      .then((res) => res.json())
      .then((json) => setPositions(json.data ?? []))
      .catch(() => setPositions([]))
      .finally(() => setLoadingPositions(false));
  }, [approverMode, selectedTeamId]);

  async function handleCreatePosition() {
    const name = newPositionName.trim();
    if (!name || selectedTeamId === "none") return;
    setCreatingPosition(true);
    try {
      const res = await fetch(`/api/v1/teams/${selectedTeamId}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create position");
      }
      const { data } = await res.json();
      setPositions((prev) => [...prev, { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedPositionId(data.id);
      setNewPositionName("");
      toast.success(`Position "${name}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create position");
    } finally {
      setCreatingPosition(false);
    }
  }

  // ---- Delete flow ----------------------------------------------------------

  function handleDeleteFlow() {
    clearDraft(flow.id);
    setConfirmDelete(false);
    if (onDelete) {
      onDelete(flow.id);
    } else {
      // Fallback if no parent handler
      fetch(`/api/v1/flows/${flow.id}`, { method: "DELETE" })
        .then((res) => {
          if (res.ok) { toast.success("Flow deleted"); router.refresh(); }
          else toast.error("Failed to delete flow");
        })
        .catch(() => toast.error("Failed to delete flow"));
    }
  }

  // ---- Source display -------------------------------------------------------

  const sourceConfig = SOURCE_CONFIG[flow.source];
  const SourceIcon = sourceConfig?.icon;
  const sourcePlatformLabel = sourceConfig?.label ?? flow.source;
  const flowLabel = flow.name || `${sourcePlatformLabel} flow`;

  // ---- Summary of current config -------------------------------------------

  function getConfigSummary(): string {
    if (!flow.is_configured) return "Not configured, any member can approve";
    // By-position mode: designated with team but no individual approvers
    if (
      flow.approver_mode === "designated" &&
      flow.assigned_team_id &&
      (!flow.assigned_approvers || flow.assigned_approvers.length === 0)
    ) {
      const team = teams.find((t) => t.id === flow.assigned_team_id);
      const positionName = flow.assigned_position_id && positionsMap?.[flow.assigned_position_id];
      if (positionName && team) return `Position: ${positionName} (${team.name})`;
      return team ? `By position: ${team.name}` : "By position (team)";
    }
    if (flow.approver_mode === "designated" && flow.assigned_approvers?.length) {
      const names = flow.assigned_approvers.map((id) => {
        const m = members.find((mem) => mem.id === id);
        return m?.name ?? id.slice(0, 8);
      });
      if (flow.is_sequential) return `Sequential: ${names.join(" → ")}`;
      const count = flow.default_required_approvals ?? 1;
      if (count > 1) return `${count} of ${names.join(", ")} must approve`;
      return names.join(", ");
    }
    if (flow.approver_mode === "role_based" && flow.required_role) {
      return `${flow.required_role}+ role required`;
    }
    if (flow.assigned_team_id) {
      const team = teams.find((t) => t.id === flow.assigned_team_id);
      return team ? `Team: ${team.name}` : "Assigned to team";
    }
    return "Any member can approve";
  }

  // ---- Save ----------------------------------------------------------------

  const handleSave = useCallback(async () => {
    let applyForNext: number | null = null;
    if (durationPreset === "forever") {
      applyForNext = null;
    } else if (durationPreset === "custom") {
      const parsed = parseInt(customCount, 10);
      if (isNaN(parsed) || parsed < 1) {
        toast.error("Enter a valid number of requests");
        return;
      }
      applyForNext = parsed;
    } else {
      applyForNext = parseInt(durationPreset, 10);
    }

    // Map UI mode to API mode. "by_position" saves as "designated" with team.
    const apiMode: ApproverMode = approverMode === "by_position" ? "designated" : approverMode;

    const payload: Record<string, unknown> = {
      approver_mode: apiMode,
      is_sequential: isSequential,
      apply_for_next: applyForNext,
      name: flowName.trim() || undefined,
      source_url: sourceUrl.trim() || null,
    };

    if (approverMode === "by_position") {
      // By position: team + optional position, no individual approvers
      if (selectedTeamId === "none") {
        toast.error("Select a team for position-based approval");
        return;
      }
      payload.assigned_team_id = selectedTeamId;
      payload.assigned_position_id = selectedPositionId !== "none" ? selectedPositionId : null;
      payload.assigned_approvers = null;
      payload.required_role = null;
      payload.default_required_approvals = requiredApprovals || 1;
    } else if (approverMode === "designated") {
      payload.assigned_approvers = selectedApprovers.length > 0 ? selectedApprovers : null;
      payload.assigned_team_id = selectedTeamId !== "none" ? selectedTeamId : null;
      payload.assigned_position_id = null;
      payload.required_role = null;
      if (selectedApprovers.length > 0) {
        payload.default_required_approvals = isSequential
          ? selectedApprovers.length
          : Math.min(requiredApprovals, selectedApprovers.length) || 1;
      } else {
        payload.default_required_approvals = requiredApprovals || 1;
      }
    } else if (approverMode === "any") {
      payload.assigned_approvers = null;
      payload.assigned_team_id = selectedTeamId !== "none" ? selectedTeamId : null;
      payload.assigned_position_id = null;
      payload.required_role = null;
      payload.default_required_approvals = requiredApprovals || 1;
    } else if (approverMode === "role_based") {
      payload.required_role = requiredRole !== "none" ? requiredRole : null;
      payload.assigned_approvers = null;
      payload.assigned_team_id = selectedTeamId !== "none" ? selectedTeamId : null;
      payload.assigned_position_id = null;
      payload.default_required_approvals = 1;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/v1/flows/${flow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to save");
      }

      clearDraft(flow.id);
      toast.success("Flow configuration saved");
      setExpanded(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [flow.id, flowName, sourceUrl, approverMode, selectedApprovers, selectedTeamId, selectedPositionId, requiredRole, isSequential, requiredApprovals, durationPreset, customCount, router]);

  // ---- Approver toggle -----------------------------------------------------

  function toggleApprover(userId: string) {
    setSelectedApprovers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  // ---- Render ---------------------------------------------------------------

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-0">
        {/* Header - always visible */}
        <button
          data-tour="flow-expand-btn"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center gap-3 text-left cursor-pointer"
        >
          {/* Source icon */}
          {sourceConfig ? (
            <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", sourceConfig.bgColor)}>
              {SourceIcon && <SourceIcon className={cn("size-4.5", sourceConfig.color)} />}
            </span>
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Settings2 className="size-4.5 text-muted-foreground" />
            </span>
          )}

          {/* Flow info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{flowLabel}</span>
              <Badge variant="secondary" className={cn("text-[10px] shrink-0 border-0", sourceConfig?.bgColor, sourceConfig?.color)}>
                {sourcePlatformLabel}
              </Badge>
              {flow.is_configured ? (
                <Badge variant="default" className="text-[10px] shrink-0">Configured</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300 shrink-0">
                  Needs setup
                </Badge>
              )}
              {isStale && (
                <Badge variant="outline" className="text-[10px] shrink-0 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-700 gap-0.5">
                  <AlertTriangle className="size-2.5" />
                  Inactive {daysSinceLastRequest}d
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <UserCheck className="size-3" />
                {getConfigSummary()}
              </span>
              {flow.request_count > 0 && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>{flow.request_count} request{flow.request_count !== 1 ? "s" : ""}</span>
                </>
              )}
              {flow.last_request_at && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span>Last {formatDistanceToNow(new Date(flow.last_request_at), { addSuffix: true })}</span>
                </>
              )}
            </div>
          </div>

          {/* Source link + Expand chevron */}
          <div className="flex items-center gap-2 shrink-0">
            {flow.source_url && (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5 text-xs"
                asChild
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
              >
                <a
                  href={flow.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="size-3" />
                  <span className="hidden sm:inline">Open in {sourcePlatformLabel}</span>
                  <span className="sm:hidden">Open</span>
                </a>
              </Button>
            )}
            {!expanded && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(true);
                    }}
                    className="flex size-7 items-center justify-center rounded-md transition-colors text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10"
                  >
                    {deleting ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top">Delete flow</TooltipContent>
              </Tooltip>
            )}
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} />
          </div>
        </button>

        {/* Expanded config form */}
        {expanded && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Flow name */}
            <div className="space-y-2">
              <FieldLabel tooltip="A friendly name to identify this workflow. If left blank, the integration name is used.">Flow name</FieldLabel>
              <Input
                value={flowName}
                onChange={(e) => setFlowName(e.target.value)}
                placeholder="e.g. New Customer Onboarding Zap"
                disabled={saving}
                className="h-9"
              />
              <p className="text-[11px] text-muted-foreground">
                A friendly name to identify this workflow. Auto-populated when the integration sends a name.
              </p>
            </div>

            {/* Source URL */}
            <div className="space-y-2">
              <FieldLabel tooltip="Link to the external workflow (Zap, Scenario, etc.) that sends requests. Enables the 'Open' button for quick access.">Source URL</FieldLabel>
              <div className="flex items-center gap-2">
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder={`e.g. https://zapier.com/app/zaps/12345`}
                  disabled={saving}
                  className="h-9 flex-1"
                  type="url"
                />
                {sourceUrl.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 shrink-0"
                    asChild
                  >
                    <a href={sourceUrl.trim()} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="size-3" />
                      Open
                    </a>
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Link to the {sourcePlatformLabel} workflow that sends requests to this flow. Paste the URL to enable the &quot;Open&quot; button.
              </p>
            </div>

            {/* Approver Mode */}
            <div className="space-y-2">
              <FieldLabel tooltip="Choose how approvers are determined: anyone with permission, specific people, by team position, or by role level.">Who must approve?</FieldLabel>
              <Select
                value={approverMode}
                onValueChange={(v) => setApproverMode(v as UIApproverMode)}
                disabled={saving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any member with approval permission</SelectItem>
                  <SelectItem value="designated">Specific people</SelectItem>
                  <SelectItem value="by_position">By position (team)</SelectItem>
                  <SelectItem value="role_based">By role</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Individual approvers - only for "Specific people" mode */}
            {approverMode === "designated" && (
              <div className="space-y-2">
                <FieldLabel tooltip="Choose which team members can approve requests from this flow. Only members with approval permission are shown.">Select Approvers</FieldLabel>
                {selectedApprovers.length > 0 && !isSequential && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedApprovers.map((id) => {
                      const member = members.find((m) => m.id === id);
                      return (
                        <Badge key={id} variant="secondary" className="gap-1 pr-1">
                          {member?.name ?? id.slice(0, 8)}
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-muted-foreground/20 cursor-pointer"
                            onClick={() => toggleApprover(id)}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                {selectedApprovers.length > 0 && isSequential && (
                  <div className="mb-2 space-y-1.5 rounded-md border bg-muted/30 p-2">
                    <p className="text-[11px] text-muted-foreground px-1">
                      Approval order. Each approver is notified only after the previous one approves.
                    </p>
                    {selectedApprovers.map((id, idx) => {
                      const member = members.find((m) => m.id === id);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
                        >
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {idx + 1}
                          </span>
                          <span className="flex-1 truncate text-sm">
                            {member?.name ?? id.slice(0, 8)}
                          </span>
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              disabled={saving || idx === 0}
                              onClick={() => {
                                setSelectedApprovers((prev) => {
                                  const next = [...prev];
                                  [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                                  return next;
                                });
                              }}
                              aria-label="Move up"
                            >
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              disabled={saving || idx === selectedApprovers.length - 1}
                              onClick={() => {
                                setSelectedApprovers((prev) => {
                                  const next = [...prev];
                                  [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                                  return next;
                                });
                              }}
                              aria-label="Move down"
                            >
                              <ChevronDown className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-6 text-muted-foreground hover:text-foreground"
                              disabled={saving}
                              onClick={() => toggleApprover(id)}
                              aria-label="Remove"
                            >
                              <X className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {members.length === 0 ? (
                    <p className="px-3 py-2 text-xs text-muted-foreground">
                      No members with approval permission found.
                    </p>
                  ) : (
                    members.map((member) => (
                      <label
                        key={member.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
                      >
                        <Checkbox
                          checked={selectedApprovers.includes(member.id)}
                          onCheckedChange={() => toggleApprover(member.id)}
                          disabled={saving}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{member.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {member.email} <span className="capitalize">({member.role})</span>
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Role selection */}
            {approverMode === "role_based" && (
              <div className="space-y-2">
                <FieldLabel tooltip="Only members at or above this role level can approve. For example, 'Admin or higher' allows Admins and Owners but not Members.">Minimum Role Required</FieldLabel>
                <Select
                  value={requiredRole}
                  onValueChange={(v) => setRequiredRole(v as UserRole | "none")}
                  disabled={saving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Only members with this role or higher can approve. For example, &quot;Admin or higher&quot; means Admins and Owners can approve, but Members cannot.
                </p>
              </div>
            )}

            {/* By Position - team + position selection */}
            {approverMode === "by_position" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <FieldLabel tooltip="Choose which team's members can approve. Only members of this team will be eligible.">Select Team</FieldLabel>
                  {teams.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-4 text-center">
                      <Users className="mx-auto size-6 text-muted-foreground/40 mb-2" />
                      <p className="text-sm text-muted-foreground">
                        You need at least one team to use position-based approval.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3 gap-1.5"
                        asChild
                      >
                        <Link href="/org/teams">
                          Go to Teams
                          <ArrowRight className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  ) : (
                    <Select
                      value={selectedTeamId}
                      onValueChange={(v) => {
                        setSelectedTeamId(v);
                        setSelectedPositionId("none");
                      }}
                      disabled={saving}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a team..." />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {selectedTeamId !== "none" && (
                  <div className="space-y-2">
                    <FieldLabel tooltip="Narrow approvers to a specific position within the team (e.g. Lead, Reviewer). Choose 'Any position' to allow all team members.">Select Position</FieldLabel>
                    <Select
                      value={selectedPositionId}
                      onValueChange={setSelectedPositionId}
                      disabled={saving || loadingPositions}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={loadingPositions ? "Loading positions..." : "Select a position..."} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Any position (all team members)</SelectItem>
                        {positions.map((pos) => (
                          <SelectItem key={pos.id} value={pos.id}>
                            {pos.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="New position name..."
                        value={newPositionName}
                        onChange={(e) => setNewPositionName(e.target.value)}
                        maxLength={100}
                        disabled={creatingPosition || saving}
                        className="h-8 text-xs flex-1"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleCreatePosition();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-xs shrink-0"
                        disabled={creatingPosition || !newPositionName.trim() || saving}
                        onClick={handleCreatePosition}
                      >
                        {creatingPosition ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                        Add
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {selectedPositionId !== "none"
                        ? "Only team members holding this position can approve."
                        : "All members of the selected team can approve."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Team selection - optional scope for any/designated/role_based */}
            {approverMode !== "by_position" && teams.length > 0 && (
              <div className="space-y-2">
                <FieldLabel tooltip="Optionally scope this flow to a team. Only that team's members will be notified and able to approve.">Assign to Team</FieldLabel>
                <Select
                  value={selectedTeamId}
                  onValueChange={setSelectedTeamId}
                  disabled={saving}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="No team selected" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team (org-wide)</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Only members of this team will be notified and asked to approve. Create teams like &quot;HR&quot;, &quot;Management&quot;, or &quot;Engineering&quot; on the{" "}
                  <Link href="/org/teams" className="underline underline-offset-2 hover:text-foreground">Teams page</Link>.
                </p>
              </div>
            )}

            {/* Sequential approval */}
            {approverMode === "designated" && selectedApprovers.length > 1 && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={`seq-${flow.id}`} className="text-sm">Sequential Approval</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="size-3 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[260px] text-xs">
                        When enabled, approvers must approve one at a time in the order listed. The next approver is only notified after the previous one approves.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Require approvers to approve in order, one after another.
                  </p>
                </div>
                <Switch
                  id={`seq-${flow.id}`}
                  checked={isSequential}
                  onCheckedChange={setIsSequential}
                  disabled={saving}
                />
              </div>
            )}

            {/* Required approvals count */}
            {approverMode === "designated" && selectedApprovers.length > 1 && !isSequential && (
              <div className="space-y-2">
                <FieldLabel tooltip="How many of the selected approvers must approve before the request is considered approved.">Required Approvals</FieldLabel>
                <Input
                  type="number"
                  min={1}
                  max={selectedApprovers.length}
                  value={requiredApprovals}
                  onChange={(e) => setRequiredApprovals(parseInt(e.target.value, 10) || 1)}
                  disabled={saving}
                  className="w-24 h-8 text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  How many of the {selectedApprovers.length} selected people must approve.
                </p>
              </div>
            )}

            {/* Duration */}
            <div className="space-y-2">
              <FieldLabel tooltip="How long these settings last. Choose 'Always' to apply permanently, or a specific number of requests before reverting to defaults.">Apply for</FieldLabel>
              <Select
                value={durationPreset}
                onValueChange={setDurationPreset}
                disabled={saving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DURATION_PRESETS.map((preset) => (
                    <SelectItem key={preset.value} value={preset.value}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {durationPreset === "custom" && (
                <Input
                  type="number"
                  min={1}
                  max={10000}
                  placeholder="Number of requests..."
                  value={customCount}
                  onChange={(e) => setCustomCount(e.target.value)}
                  disabled={saving}
                  className="h-8 text-xs"
                  autoFocus
                />
              )}
              <p className="text-[11px] text-muted-foreground">
                {durationPreset === "forever"
                  ? "These settings apply to all future requests from this flow."
                  : durationPreset === "custom"
                    ? customCount
                      ? `These settings apply to the next ${customCount} requests, then revert.`
                      : "Enter how many requests these settings should apply to."
                    : durationPreset === "1"
                      ? "These settings only apply to the next request from this flow."
                      : `These settings apply to the next ${durationPreset} requests, then revert.`}
              </p>
            </div>

            {/* Save / Cancel / Delete */}
            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    clearDraft(flow.id);
                    setFlowName(flow.name ?? "");
                    setSourceUrl(flow.source_url ?? "");
                    setApproverMode(initialUIMode);
                    setSelectedApprovers(flow.assigned_approvers ?? []);
                    setSelectedTeamId(flow.assigned_team_id ?? "none");
                    setRequiredRole(flow.required_role ?? "none");
                    setIsSequential(flow.is_sequential ?? false);
                    setRequiredApprovals(flow.default_required_approvals ?? 1);
                    setDurationPreset(initialDurationPreset);
                    setCustomCount(initialCustomCount);
                    setSelectedPositionId(flow.assigned_position_id ?? "none");
                    setExpanded(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmDelete(true);
                }}
                disabled={saving || deleting}
              >
                <Trash2 className="size-3.5" />
                Delete
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Delete confirmation dialog */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete flow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;{flow.name}&rdquo;? This will remove all routing configuration for this flow. Existing requests will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteFlow}
              disabled={deleting}
              className="!bg-destructive !text-destructive-foreground hover:!bg-destructive/90"
            >
              {deleting ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Trash2 className="size-3.5 mr-1" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
});
