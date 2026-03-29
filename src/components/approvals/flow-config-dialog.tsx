"use client";

import { useState, useEffect, useCallback } from "react";
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
import { X } from "lucide-react";
import type { ApprovalFlow, ApprovalRequest, UserRole, ApproverMode } from "@/lib/types/database";

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

export function FlowConfigDialog({
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
  const [approverMode, setApproverMode] = useState<ApproverMode>("any");
  const [selectedApprovers, setSelectedApprovers] = useState<string[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("none");
  const [requiredRole, setRequiredRole] = useState<UserRole | "none">("none");
  const [isSequential, setIsSequential] = useState(false);
  const [requiredApprovals, setRequiredApprovals] = useState(1);

  // Duration
  const [durationPreset, setDurationPreset] = useState("forever");
  const [customCount, setCustomCount] = useState("");

  const [saving, setSaving] = useState(false);

  // ---- Load flow + org data -------------------------------------------------

  const loadData = useCallback(async () => {
    if (!approval?.flow_id) return;

    setLoadingFlow(true);
    try {
      // Fetch flow, members, and teams in parallel
      const [flowRes, membersRes, teamsRes] = await Promise.all([
        fetch(`/api/v1/flows/${approval.flow_id}`),
        (async () => {
          const supabase = createClient();
          const { data } = await supabase
            .from("org_memberships")
            .select("user_id, role, can_approve")
            .eq("org_id", orgId)
            .eq("can_approve", true);
          if (!data) return [];

          const userIds = data.map((m) => m.user_id);
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", userIds);

          return (data ?? []).map((m) => {
            const profile = profiles?.find((p) => p.id === m.user_id);
            return {
              id: m.user_id,
              name: profile?.full_name || profile?.email || m.user_id,
              email: profile?.email || "",
              role: m.role as UserRole,
            };
          });
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
        setApproverMode(flowData.approver_mode || "any");
        setSelectedApprovers(flowData.assigned_approvers ?? []);
        setSelectedTeamId(flowData.assigned_team_id ?? "none");
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

  // ---- Reset on close -------------------------------------------------------

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      setFlow(null);
      setSelectedApprovers([]);
      setSelectedTeamId("none");
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

    const payload: Record<string, unknown> = {
      approver_mode: approverMode,
      is_sequential: isSequential,
      apply_for_next: applyForNext,
    };

    if (approverMode === "designated" || approverMode === "any") {
      payload.assigned_approvers = selectedApprovers.length > 0 ? selectedApprovers : null;
      payload.assigned_team_id = selectedTeamId !== "none" ? selectedTeamId : null;
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
                onValueChange={(v) => setApproverMode(v as ApproverMode)}
                disabled={saving}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any approver</SelectItem>
                  <SelectItem value="designated">Specific people</SelectItem>
                  <SelectItem value="role_based">By role</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {approverMode === "any" && "Any member with approval permission can approve."}
                {approverMode === "designated" && "Only the selected people can approve these requests."}
                {approverMode === "role_based" && "Only members with the selected role (or higher) can approve."}
              </p>
            </div>

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
                {selectedApprovers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {selectedApprovers.map((id) => {
                      const member = members.find((m) => m.id === id);
                      return (
                        <Badge
                          key={id}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          {member?.name ?? id.slice(0, 8)}
                          <button
                            type="button"
                            className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                            onClick={() => toggleApprover(id)}
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <div className="max-h-40 overflow-y-auto rounded-md border">
                  {members.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-muted-foreground">
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
                          <div className="text-sm font-medium truncate">
                            {member.name}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {member.email}
                            {" "}
                            <span className="capitalize">({member.role})</span>
                          </div>
                        </div>
                      </label>
                    ))
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
          >
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
