"use client";

import { useState, useEffect, useCallback, memo } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { X, Plus, Loader2, Info, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { ApprovalFlow, ApprovalRequest, UserRole, ApproverMode } from "@/lib/types/database";

// UI-level approver mode. "by_position" maps to "designated" + assigned_team_id on save.
type UIApproverMode = ApproverMode | "by_position";

// ---- Types ------------------------------------------------------------------

interface TeamOption {
  id: string;
  name: string;
}

interface MemberOption {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  canApprove: boolean;
}

interface FlowConfigDialogProps {
  /** The approval that triggered the dialog (used to resolve the flow). */
  approval: ApprovalRequest | null;
  open: boolean;
  onClose: () => void;
  orgId: string;
}

// ---- Constants --------------------------------------------------------------

const DURATION_PRESETS = [
  { label: "This request only", value: "1" },
  { label: "Next 5 requests", value: "5" },
  { label: "Next 10 requests", value: "10" },
  { label: "Next 25 requests", value: "25" },
  { label: "Next 50 requests", value: "50" },
  { label: "Always (forever)", value: "forever" },
  { label: "Custom...", value: "custom" },
] as const;

const ROLE_OPTIONS: { label: string; value: UserRole }[] = [
  { label: "Member (anyone)", value: "member" },
  { label: "Approver or higher", value: "approver" },
  { label: "Admin or higher", value: "admin" },
  { label: "Owner only", value: "owner" },
];

// ---- Component --------------------------------------------------------------

export const FlowConfigDialog = memo(function FlowConfigDialog({
  approval,
  open,
  onClose,
  orgId,
}: FlowConfigDialogProps) {
  // Flow data loaded from API
  const [flow, setFlow] = useState<ApprovalFlow | null>(null);
  const [loadingFlow, setLoadingFlow] = useState(false);

  // Org members & teams (for approver selection)
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);

  // Form state
  const [approverMode, setApproverMode] = useState<UIApproverMode>("any");
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("none");
  const [selectedPositionId, setSelectedPositionId] = useState<string>("none");
  const [positions, setPositions] = useState<{ id: string; name: string }[]>([]);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [newPositionName, setNewPositionName] = useState("");
  const [creatingPosition, setCreatingPosition] = useState(false);
  const [requiredRole, setRequiredRole] = useState<UserRole | "none">("none");
  const [isSequential, setIsSequential] = useState(false);
  const [requiredApprovals, setRequiredApprovals] = useState(1);

  // Duration
  const [durationPreset, setDurationPreset] = useState("forever");
  const [customCount, setCustomCount] = useState("");

  const [saving, setSaving] = useState(false);

  // ---- Create position inline ------------------------------------------------

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

  // ---- Load flow + org data -------------------------------------------------

  const loadData = useCallback(async () => {
    if (!approval?.flow_id) return;

    setLoadingFlow(true);
    try {
      // Fetch flow, members, and teams in parallel
      const [flowRes, membersRes, teamsRes] = await Promise.all([
        fetch(`/api/v1/flows/${approval.flow_id}`),
        (async () => {
          // Use the admin-backed team members endpoint so we see every member
          // (the browser's Supabase client is RLS-gated and may miss rows).
          try {
            const res = await fetch("/api/v1/team/members");
            if (!res.ok) return [];
            const json = await res.json();
            const rows = (json.data ?? []) as Array<{
              id: string;
              email: string;
              full_name: string | null;
              role: UserRole;
              can_approve: boolean;
            }>;
            return rows.map((m) => ({
              id: m.id,
              name: m.full_name || m.email || m.id,
              email: m.email || "",
              role: m.role,
              canApprove: !!m.can_approve,
            }));
          } catch {
            return [];
          }
        })(),
        (async () => {
          const supabase = createClient();
          const { data } = await supabase
            .from("teams")
            .select("id, name")
            .eq("org_id", orgId)
            .order("name");
          return (data ?? []) as TeamOption[];
        })(),
      ]);

      setMembers(membersRes);
      setTeams(teamsRes);

      if (flowRes.ok) {
        const flowData: ApprovalFlow = await flowRes.json();
        setFlow(flowData);

        // Populate form with existing flow config
        // Detect "by_position" mode: designated with a team but no individual approvers
        const detectedMode: UIApproverMode =
          flowData.approver_mode === "designated" &&
          flowData.assigned_team_id &&
          (!flowData.assigned_approvers || flowData.assigned_approvers.length === 0)
            ? "by_position"
            : flowData.approver_mode || "any";
        setApproverMode(detectedMode);
        setSelectedApprovers(flowData.assigned_approvers ?? []);
        setSelectedTeamId(flowData.assigned_team_id ?? "none");
        setSelectedPositionId(flowData.assigned_position_id ?? "none");
        setRequiredRole(flowData.required_role ?? "none");
        setIsSequential(flowData.is_sequential ?? false);
        setRequiredApprovals(flowData.default_required_approvals ?? 1);

        // Duration
        if (flowData.apply_for_next === null) {
          setDurationPreset("forever");
        } else if (flowData.apply_for_next <= 1) {
          setDurationPreset("1");
        } else {
          const match = DURATION_PRESETS.find(
            (p) => p.value !== "forever" && p.value !== "custom" && Number(p.value) === flowData.apply_for_next,
          );
          if (match) {
            setDurationPreset(match.value);
          } else {
            setDurationPreset("custom");
            setCustomCount(String(flowData.apply_for_next));
          }
        }
      }
    } catch {
      toast.error("Failed to load flow configuration");
    } finally {
      setLoadingFlow(false);
    }
  }, [approval?.flow_id, orgId]);

  useEffect(() => {
    if (open && approval?.flow_id) {
      loadData();
    }
  }, [open, approval?.flow_id, loadData]);

  // Fetch positions when team changes in by_position mode
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

  // ---- Reset on close -------------------------------------------------------

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setFlow(null);
      setSelectedApprovers([]);
      setSelectedTeamId("none");
      setSelectedPositionId("none");
      setPositions([]);
      setNewPositionName("");
      setCreatingPosition(false);
      setRequiredRole("none");
      setApproverMode("any");
      setIsSequential(false);
      setRequiredApprovals(1);
      setDurationPreset("forever");
      setCustomCount("");
      onClose();
    }
  }

  // ---- Save -----------------------------------------------------------------

  async function handleSave() {
    if (!flow) return;

    // Compute apply_for_next
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
    };

    if (approverMode === "by_position") {
      if (selectedTeamId === "none") {
        toast.error("Select a team for position-based approval");
        return;
      }
      payload.assigned_team_id = selectedTeamId;
      payload.assigned_position_id = selectedPositionId !== "none" ? selectedPositionId : null;
      payload.assigned_approvers = null;
      payload.required_role = null;
      payload.default_required_approvals = requiredApprovals || 1;
    } else if (approverMode === "designated" || approverMode === "any") {
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

      toast.success("Flow configuration saved");
      handleOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save flow configuration");
    } finally {
      setSaving(false);
    }
  }

  // ---- Approver helpers -----------------------------------------------------

  function toggleApprover(userId: string) {
    setSelectedApprovers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  }

  // Members whose display name collides with at least one other — disambiguate by email.
  const duplicateNameIds = (() => {
    const counts = new Map<string, number>();
    for (const m of members) {
      const key = (m.name ?? "").trim().toLowerCase();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const ids = new Set<string>();
    for (const m of members) {
      const key = (m.name ?? "").trim().toLowerCase();
      if (key && (counts.get(key) ?? 0) > 1) ids.add(m.id);
    }
    return ids;
  })();

  function approverLabel(userId: string): string {
    const m = members.find((mem) => mem.id === userId);
    if (!m) return userId.slice(0, 8);
    if (duplicateNameIds.has(userId) && m.email) return `${m.name} (${m.email})`;
    return m.name;
  }

  // ---- Source display -------------------------------------------------------

  const sourceName = flow
    ? flow.name || `${flow.source} / ${flow.source_id}`
    : approval?.source ?? "Unknown";

  // ---- Render ---------------------------------------------------------------

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configure Flow Approvals</DialogTitle>
          <DialogDescription>
            Set who needs to approve requests from{" "}
            <span className="font-medium text-foreground">{sourceName}</span>.
            These settings will apply to future requests from this source.
          </DialogDescription>
        </DialogHeader>

        {loadingFlow ? (
          <div className="flex items-center justify-center py-8">
            <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Approver Mode */}
            <div className="space-y-2">
              <Label>Approval Mode</Label>
              <Select
                value={approverMode}
                onValueChange={(v) => setApproverMode(v as UIApproverMode)}
                disabled={saving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any approver</SelectItem>
                  <SelectItem value="designated">Specific people</SelectItem>
                  <SelectItem value="by_position">By position (team)</SelectItem>
                  <SelectItem value="role_based">By role</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {approverMode === "any" && "Any member with approval permission can approve."}
                {approverMode === "designated" && "Only the selected people can approve these requests."}
                {approverMode === "by_position" && "Only members of a specific team and position can approve."}
                {approverMode === "role_based" && "Only members with the selected role (or higher) can approve."}
              </p>
            </div>

            {/* By Position - team + position selection */}
            {approverMode === "by_position" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Team</Label>
                  {teams.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No teams found. Create teams on the Teams page first.
                    </p>
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
                    <Label>Select Position</Label>
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
                    <p className="text-xs text-muted-foreground">
                      {selectedPositionId !== "none"
                        ? "Only team members holding this position can approve."
                        : "All members of the selected team can approve."}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Role selection (role_based mode) */}
            {approverMode === "role_based" && (
              <div className="space-y-2">
                <Label>Required Role</Label>
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
              </div>
            )}

            {/* Team selection (any or designated mode) */}
            {(approverMode === "any" || approverMode === "designated" || approverMode === "role_based") && teams.length > 0 && (
              <div className="space-y-2">
                <Label>Assign to Team</Label>
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
              </div>
            )}

            {/* Individual approvers (designated mode) */}
            {approverMode === "designated" && (
              <div className="space-y-2">
                <Label>Select Approvers</Label>
                {selectedApprovers.length > 0 && !isSequential && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedApprovers.map((id) => (
                      <Badge
                        key={id}
                        variant="secondary"
                        className="gap-1 pr-1"
                      >
                        {approverLabel(id)}
                        <button
                          type="button"
                          className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                          onClick={() => toggleApprover(id)}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                {selectedApprovers.length > 0 && isSequential && (
                  <div className="mb-2 space-y-1.5 rounded-md border bg-muted/30 p-2">
                    <p className="text-[11px] text-muted-foreground px-1">
                      Approval order. Each approver is notified only after the previous one approves. Tick more people in the list below to add them to the end of the sequence.
                    </p>
                    {selectedApprovers.map((id, idx) => (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
                      >
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {idx + 1}
                        </span>
                        <span className="flex-1 truncate text-sm">
                          {approverLabel(id)}
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
                    ))}
                  </div>
                )}
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {members.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
                      No members found.
                    </p>
                  ) : (
                    members.map((member) => {
                      const disabled = saving || !member.canApprove;
                      return (
                        <label
                          key={member.id}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2",
                            disabled
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer hover:bg-accent",
                          )}
                        >
                          <Checkbox
                            checked={selectedApprovers.includes(member.id)}
                            onCheckedChange={() => toggleApprover(member.id)}
                            disabled={disabled}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium truncate">
                              {member.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {member.email}
                              {" "}
                              <span className="capitalize">({member.role})</span>
                            </div>
                          </div>
                          {!member.canApprove && (
                            <Link
                              href="/org/members"
                              className="shrink-0 text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                              title="Grant approval permission on the Members page"
                              onClick={(e) => e.stopPropagation()}
                            >
                              No approval permission
                            </Link>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* Sequential approval */}
            {approverMode === "designated" && selectedApprovers.length > 1 && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label htmlFor="flow-sequential" className="text-sm">
                    Sequential Approval
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Require approvers to approve in order, one after another.
                  </p>
                </div>
                <Switch
                  id="flow-sequential"
                  checked={isSequential}
                  onCheckedChange={setIsSequential}
                  disabled={saving}
                />
              </div>
            )}

            {/* Required approvals count (designated + non-sequential) */}
            {approverMode === "designated" && selectedApprovers.length > 1 && !isSequential && (
              <div className="space-y-2">
                <Label htmlFor="flow-required-count">Required Approvals</Label>
                <Input
                  id="flow-required-count"
                  type="number"
                  min={1}
                  max={selectedApprovers.length}
                  value={requiredApprovals}
                  onChange={(e) => setRequiredApprovals(parseInt(e.target.value, 10) || 1)}
                  disabled={saving}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">
                  How many of the {selectedApprovers.length} selected people must approve.
                </p>
              </div>
            )}

            {/* Duration */}
            <div className="space-y-2">
              <Label>Apply For</Label>
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
                  autoFocus
                />
              )}

              <p className="text-xs text-muted-foreground">
                {durationPreset === "forever"
                  ? "These settings will apply to all future requests from this flow."
                  : durationPreset === "1"
                    ? "These settings will only apply to the next request from this flow."
                    : durationPreset === "custom"
                      ? customCount
                        ? `These settings will apply to the next ${customCount} requests, then revert.`
                        : "Enter the number of requests these settings should apply to."
                      : `These settings will apply to the next ${durationPreset} requests, then revert.`}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loadingFlow}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
