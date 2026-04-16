"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Mail, Users, Send, Clock, X, Shield, ShieldCheck, User, ChevronDown, Check, Plus, Loader2, ArrowLeft, Plug } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { OrgInvite } from "@/lib/types/database";

interface BulkInviteEntry {
  email: string;
  role: "admin" | "approver" | "member";
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function parseEmails(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && EMAIL_REGEX.test(e));
}

interface TeamOption {
  id: string;
  name: string;
}

interface V2InviteSectionProps {
  invites: OrgInvite[];
  teams: TeamOption[];
}

export function V2InviteSection({ invites, teams }: V2InviteSectionProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "approver" | "member">("member");
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [teamLeadIds, setTeamLeadIds] = useState<string[]>([]);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [canConnect, setCanConnect] = useState(false);
  const [loading, setLoading] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const visibleInvites = invites.filter((i) => !removedIds.has(i.id));

  // Bulk mode state
  const [bulkInput, setBulkInput] = useState("");
  const [bulkEntries, setBulkEntries] = useState<BulkInviteEntry[]>([]);
  const [bulkTeamIds, setBulkTeamIds] = useState<string[]>([]);
  const [bulkCanApprove, setBulkCanApprove] = useState(false);
  const [bulkCanConnect, setBulkCanConnect] = useState(false);
  const [bulkTeamLeadIds, setBulkTeamLeadIds] = useState<string[]>([]);
  const [bulkTeamDropdownOpen, setBulkTeamDropdownOpen] = useState(false);
  const [showBulkList, setShowBulkList] = useState(false);

  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);

  const singleTeamRef = useRef<HTMLDivElement>(null);
  const bulkTeamRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (singleTeamRef.current && !singleTeamRef.current.contains(e.target as Node)) {
        setTeamDropdownOpen(false);
      }
      if (bulkTeamRef.current && !bulkTeamRef.current.contains(e.target as Node)) {
        setBulkTeamDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Position state. Prefetch all team positions on mount so selection is instant.
  interface PositionOption { id: string; name: string }
  const [positionsByTeam, setPositionsByTeam] = useState<Record<string, PositionOption[]>>({});
  const [selectedPositionId, setSelectedPositionId] = useState<string | null>(null);
  const [bulkPositionId, setBulkPositionId] = useState<string | null>(null);
  const [newPositionName, setNewPositionName] = useState("");
  const [creatingPosition, setCreatingPosition] = useState(false);

  // Prefetch positions for all teams in the background on mount
  useEffect(() => {
    if (teams.length === 0) return;
    let cancelled = false;
    Promise.allSettled(
      teams.map((team) =>
        fetch(`/api/v1/teams/${team.id}/positions`)
          .then((res) => res.json())
          .then((json) => ({ teamId: team.id, positions: (json.data ?? []) as PositionOption[] })),
      ),
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, PositionOption[]> = {};
      for (const result of results) {
        if (result.status === "fulfilled") {
          map[result.value.teamId] = result.value.positions;
        }
      }
      setPositionsByTeam(map);
    });
    return () => { cancelled = true; };
  }, [teams]);

  const singleActiveTeamId = selectedTeamIds.length === 1 ? selectedTeamIds[0] : null;
  const bulkActiveTeamId = bulkTeamIds.length === 1 ? bulkTeamIds[0] : null;

  const positions = singleActiveTeamId
    ? positionsByTeam[singleActiveTeamId] ?? []
    : bulkActiveTeamId
      ? positionsByTeam[bulkActiveTeamId] ?? []
      : [];

  // Reset position when team selection changes
  useEffect(() => {
    setSelectedPositionId(null);
  }, [singleActiveTeamId]);

  useEffect(() => {
    setBulkPositionId(null);
  }, [bulkActiveTeamId]);

  async function handleCreatePosition(teamId: string) {
    const name = newPositionName.trim();
    if (!name) return;
    setCreatingPosition(true);
    try {
      const res = await fetch(`/api/v1/teams/${teamId}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create position");
      }
      const { data } = await res.json();
      setPositionsByTeam((prev) => ({
        ...prev,
        [teamId]: [...(prev[teamId] ?? []), { id: data.id, name: data.name }].sort((a, b) => a.name.localeCompare(b.name)),
      }));
      if (bulkMode) {
        setBulkPositionId(data.id);
      } else {
        setSelectedPositionId(data.id);
      }
      setNewPositionName("");
      toast.success(`Position "${name}" created`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create position");
    } finally {
      setCreatingPosition(false);
    }
  }

  // Parse emails from textarea
  const parsedCount = useMemo(() => parseEmails(bulkInput).length, [bulkInput]);

  function handleParseBulk() {
    const emails = [...new Set(parseEmails(bulkInput))];
    if (emails.length === 0) {
      toast.error("No valid email addresses found");
      return;
    }
    setBulkEntries(emails.map((e) => ({ email: e, role: "member" })));
    setShowBulkList(true);
  }

  function handleRemoveBulkEntry(email: string) {
    setBulkEntries((prev) => prev.filter((e) => e.email !== email));
  }

  function handleBulkRoleChange(email: string, newRole: "admin" | "approver" | "member") {
    setBulkEntries((prev) =>
      prev.map((e) => (e.email === email ? { ...e, role: newRole } : e)),
    );
  }

  function handleSetAllRoles(newRole: "admin" | "approver" | "member") {
    setBulkEntries((prev) => prev.map((e) => ({ ...e, role: newRole })));
  }

  async function sendInvite(
    targetEmail: string,
    targetRole: "admin" | "approver" | "member",
    teamIds: string[] = [],
    positionId: string | null = null,
    permissions: { can_approve: boolean; can_connect: boolean } = { can_approve: false, can_connect: false },
    leadIds: string[] = [],
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch("/api/v1/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: targetEmail,
        role: targetRole,
        team_ids: teamIds,
        position_id: positionId,
        can_approve: permissions.can_approve,
        can_connect: permissions.can_connect,
        team_lead_ids: leadIds,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? "Failed to send invite" };
    }
    return { ok: true };
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      toast.error("Please enter a valid email address (e.g. name@company.com)");
      return;
    }

    setLoading(true);
    try {
      const result = await sendInvite(trimmedEmail, role, selectedTeamIds, selectedPositionId, {
        can_approve: canApprove,
        can_connect: canConnect,
      }, teamLeadIds);
      if (!result.ok) throw new Error(result.error);
      toast.success(`Invitation sent to ${trimmedEmail}`);
      setEmail("");
      setRole("member");
      setSelectedTeamIds([]);
      setTeamLeadIds([]);
      setSelectedPositionId(null);
      setCanApprove(false);
      setCanConnect(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkSubmit() {
    if (bulkEntries.length === 0) return;

    setLoading(true);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entry of bulkEntries) {
      const result = await sendInvite(entry.email, entry.role, bulkTeamIds, bulkPositionId, {
        can_approve: bulkCanApprove,
        can_connect: bulkCanConnect,
      }, bulkTeamLeadIds);
      if (result.ok) sent++;
      else {
        failed++;
        errors.push(`${entry.email}: ${result.error}`);
      }
    }

    if (sent > 0) {
      toast.success(`${sent} invitation${sent > 1 ? "s" : ""} sent`);
    }
    if (failed > 0) {
      toast.error(
        `${failed} failed: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`,
      );
    }

    setBulkInput("");
    setBulkEntries([]);
    setBulkTeamIds([]);
    setBulkTeamLeadIds([]);
    setBulkPositionId(null);
    setBulkCanApprove(false);
    setBulkCanConnect(false);
    setShowBulkList(false);
    setLoading(false);
    router.refresh();
  }

  async function handleRevoke(inviteId: string) {
    setRemovedIds((prev) => new Set(prev).add(inviteId));
    try {
      const res = await fetch("/api/v1/team/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to revoke invite");
      }
      toast.success("Invite revoked");
      router.refresh();
    } catch (err) {
      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.delete(inviteId);
        return next;
      });
      toast.error(
        err instanceof Error ? err.message : "Failed to revoke invite",
      );
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Send invite form */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Send Invite</h2>
          <button
            onClick={() => {
              setBulkMode(!bulkMode);
              setShowBulkList(false);
              setBulkEntries([]);
              setBulkInput("");
            }}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            <Users className="size-3" />
            {bulkMode ? "Single" : "Bulk"}
          </button>
        </div>

        <div className="rounded-xl border border-border/50 bg-white dark:bg-card p-4">
          {bulkMode ? (
            <div className="space-y-4">
              {!showBulkList ? (
                /* Step 1: Paste emails */
                <>
                  <div className="space-y-1.5">
                    <Label htmlFor="bulk-emails" className="text-xs">
                      Email addresses
                    </Label>
                    <Textarea
                      id="bulk-emails"
                      placeholder={
                        "alice@company.com\nbob@company.com\ncharlie@company.com"
                      }
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      disabled={loading}
                      rows={5}
                      className="font-mono text-sm"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Separate with commas, semicolons, or new lines.
                      {parsedCount > 0 && (
                        <span className="text-foreground font-medium">
                          {" "}
                          {parsedCount} detected
                        </span>
                      )}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 gap-1.5"
                    disabled={parsedCount === 0}
                    onClick={handleParseBulk}
                  >
                    Continue
                  </Button>
                </>
              ) : (
                /* Step 2: Review & assign roles */
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium">
                      {bulkEntries.length} invite
                      {bulkEntries.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex items-center gap-1 rounded-lg border border-border bg-white dark:bg-card p-0.5">
                      <span className="text-[11px] font-medium text-muted-foreground px-1.5">
                        Set all
                      </span>
                      <button
                        type="button"
                        onClick={() => handleSetAllRoles("member")}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        Member
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllRoles("approver")}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        Approver
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetAllRoles("admin")}
                        className="rounded-md px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                      >
                        Admin
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                    {bulkEntries.map((entry) => (
                      <div
                        key={entry.email}
                        className="flex items-center gap-2 rounded-lg border border-border/50 bg-white dark:bg-card px-3 py-2"
                      >
                        <p className="flex-1 min-w-0 truncate text-sm">
                          {entry.email}
                        </p>
                        <Select
                          value={entry.role}
                          onValueChange={(v) =>
                            handleBulkRoleChange(
                              entry.email,
                              v as "admin" | "approver" | "member",
                            )
                          }
                        >
                          <SelectTrigger className="w-[120px] h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="member">
                              <User className="mr-1 inline size-3" />
                              Member
                            </SelectItem>
                            <SelectItem value="approver">
                              <ShieldCheck className="mr-1 inline size-3" />
                              Approver
                            </SelectItem>
                            <SelectItem value="admin">
                              <Shield className="mr-1 inline size-3" />
                              Admin
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() =>
                            handleRemoveBulkEntry(entry.email)
                          }
                          className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <X className="size-3" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {teams.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Add to teams (optional)</Label>
                      <div className="relative" ref={bulkTeamRef}>
                        <button
                          type="button"
                          onClick={() => setBulkTeamDropdownOpen(!bulkTeamDropdownOpen)}
                          disabled={loading}
                          className="flex w-full items-center justify-between rounded-md border border-input bg-white dark:bg-card px-3 py-2 text-sm h-9 hover:bg-white/80 dark:hover:bg-card/80 transition-colors disabled:opacity-50"
                        >
                          <span className={bulkTeamIds.length === 0 ? "text-muted-foreground" : ""}>
                            {bulkTeamIds.length === 0
                              ? "Select teams..."
                              : bulkTeamIds.length === 1
                                ? teamMap.get(bulkTeamIds[0]) ?? "1 team selected"
                                : `${bulkTeamIds.length} teams selected`}
                          </span>
                          <ChevronDown className="size-3.5 text-muted-foreground" />
                        </button>
                        {bulkTeamDropdownOpen && (
                          <div className="absolute z-10 mt-1 w-full rounded-md border bg-white dark:bg-card shadow-md py-1 max-h-[160px] overflow-y-auto">
                            {teams.map((team) => {
                              const selected = bulkTeamIds.includes(team.id);
                              return (
                                <button
                                  key={team.id}
                                  type="button"
                                  onClick={() => {
                                    setBulkTeamIds((prev) =>
                                      selected ? prev.filter((id) => id !== team.id) : [...prev, team.id],
                                    );
                                    if (selected) {
                                      setBulkTeamLeadIds((prev) => prev.filter((id) => id !== team.id));
                                    }
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                                >
                                  <div className={`flex size-4 items-center justify-center rounded border ${selected ? "bg-primary border-primary" : "border-input"}`}>
                                    {selected && <Check className="size-3 text-primary-foreground" />}
                                  </div>
                                  <Users className="size-3 text-muted-foreground" />
                                  {team.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {bulkTeamIds.length > 0 && (
                        <div className="space-y-1.5">
                          {bulkTeamIds.map((id) => (
                            <div
                              key={id}
                              className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5"
                            >
                              <div className="flex items-center gap-1.5">
                                <Users className="size-3 text-muted-foreground" />
                                <span className="text-[11px] font-medium">{teamMap.get(id)}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkTeamIds((prev) => prev.filter((tid) => tid !== id));
                                    setBulkTeamLeadIds((prev) => prev.filter((tid) => tid !== id));
                                  }}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <X className="size-2.5" />
                                </button>
                              </div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <span className="text-[10px] text-muted-foreground">Lead</span>
                                    <Switch
                                      checked={bulkTeamLeadIds.includes(id)}
                                      onCheckedChange={(checked) =>
                                        setBulkTeamLeadIds((prev) =>
                                          checked ? [...prev, id] : prev.filter((tid) => tid !== id),
                                        )
                                      }
                                      disabled={loading}
                                      className="scale-75"
                                    />
                                  </label>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  Make invitees team leads. They can add/remove members and invite new people to this team.
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {bulkActiveTeamId && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Position (optional)</Label>
                      <Select
                        value={bulkPositionId ?? "none"}
                        onValueChange={(v) => setBulkPositionId(v === "none" ? null : v)}
                        disabled={loading}
                      >
                        <SelectTrigger className="w-full h-9">
                          <SelectValue placeholder="No position" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No position</SelectItem>
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
                          disabled={creatingPosition}
                          className="h-8 text-xs flex-1"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreatePosition(bulkActiveTeamId);
                            }
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs shrink-0"
                          disabled={creatingPosition || !newPositionName.trim()}
                          onClick={() => handleCreatePosition(bulkActiveTeamId)}
                        >
                          {creatingPosition ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                          Add
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Permissions for bulk invites */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Permissions</Label>
                    <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className={`size-3.5 ${bulkCanApprove ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                          <span className="text-xs">Can approve requests</span>
                        </div>
                        <Switch
                          checked={bulkCanApprove}
                          onCheckedChange={setBulkCanApprove}
                          disabled={loading}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plug className={`size-3.5 ${bulkCanConnect ? "text-blue-500" : "text-muted-foreground/40"}`} />
                          <span className="text-xs">Can create connections</span>
                        </div>
                        <Switch
                          checked={bulkCanConnect}
                          onCheckedChange={setBulkCanConnect}
                          disabled={loading}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        setShowBulkList(false);
                        setBulkEntries([]);
                        setBulkTeamIds([]);
                        setBulkTeamLeadIds([]);
                        setBulkPositionId(null);
                        setBulkCanApprove(false);
                        setBulkCanConnect(false);
                      }}
                      disabled={loading}
                    >
                      Back
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-9 gap-1.5"
                      disabled={loading || bulkEntries.length === 0}
                      onClick={handleBulkSubmit}
                    >
                      <Send className="size-3.5" />
                      {loading
                        ? "Sending..."
                        : `Send ${bulkEntries.length} invite${bulkEntries.length !== 1 ? "s" : ""}`}
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={handleSingleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email" className="text-xs">
                  Email address
                </Label>
                <div className="relative">
                  <Mail className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    id="invite-email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    className="pl-9 h-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="invite-role" className="text-xs">
                  Role
                </Label>
                <Select
                  value={role}
                  onValueChange={(v) => {
                    const r = v as "admin" | "approver" | "member";
                    setRole(r);
                    if (r === "admin") {
                      setCanApprove(true);
                      setCanConnect(true);
                    } else if (r === "approver") {
                      setCanApprove(true);
                    }
                  }}
                  disabled={loading}
                >
                  <SelectTrigger id="invite-role" className="w-full h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="approver">Approver</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Permissions */}
              <div className="space-y-1.5">
                <Label className="text-xs">Permissions</Label>
                <div className="space-y-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className={`size-3.5 ${canApprove ? "text-emerald-500" : "text-muted-foreground/40"}`} />
                          <span className="text-xs">Can approve requests</span>
                        </div>
                        <Switch
                          checked={canApprove}
                          onCheckedChange={setCanApprove}
                          disabled={loading || role === "admin" || role === "approver"}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {role === "admin" || role === "approver"
                        ? `${role === "admin" ? "Admins" : "Approvers"} always have approval permission.`
                        : "Allow this member to approve or reject requests."}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plug className={`size-3.5 ${canConnect ? "text-blue-500" : "text-muted-foreground/40"}`} />
                          <span className="text-xs">Can create connections</span>
                        </div>
                        <Switch
                          checked={canConnect}
                          onCheckedChange={setCanConnect}
                          disabled={loading || role === "admin"}
                        />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      {role === "admin"
                        ? "Admins always have connect permission."
                        : "Allow this member to create API connections and OAuth apps."}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
              {teams.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Add to teams (optional)</Label>
                  <div className="relative" ref={singleTeamRef}>
                    <button
                      type="button"
                      onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                      disabled={loading}
                      className="flex w-full items-center justify-between rounded-md border border-input bg-white dark:bg-card px-3 py-2 text-sm h-9 hover:bg-white/80 dark:hover:bg-card/80 transition-colors disabled:opacity-50"
                    >
                      <span className={selectedTeamIds.length === 0 ? "text-muted-foreground" : ""}>
                        {selectedTeamIds.length === 0
                          ? "Select teams..."
                          : selectedTeamIds.length === 1
                            ? teamMap.get(selectedTeamIds[0]) ?? "1 team selected"
                            : `${selectedTeamIds.length} teams selected`}
                      </span>
                      <ChevronDown className="size-3.5 text-muted-foreground" />
                    </button>
                    {teamDropdownOpen && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-white dark:bg-card shadow-md py-1 max-h-[160px] overflow-y-auto">
                        {teams.map((team) => {
                          const selected = selectedTeamIds.includes(team.id);
                          return (
                            <button
                              key={team.id}
                              type="button"
                              onClick={() => {
                                setSelectedTeamIds((prev) =>
                                  selected ? prev.filter((id) => id !== team.id) : [...prev, team.id],
                                );
                                if (selected) {
                                  setTeamLeadIds((prev) => prev.filter((id) => id !== team.id));
                                }
                              }}
                              className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
                            >
                              <div className={`flex size-4 items-center justify-center rounded border ${selected ? "bg-primary border-primary" : "border-input"}`}>
                                {selected && <Check className="size-3 text-primary-foreground" />}
                              </div>
                              <Users className="size-3 text-muted-foreground" />
                              {team.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  {selectedTeamIds.length > 0 && (
                    <div className="space-y-1.5">
                      {selectedTeamIds.map((id) => (
                        <div
                          key={id}
                          className="flex items-center justify-between rounded-md bg-muted px-2.5 py-1.5"
                        >
                          <div className="flex items-center gap-1.5">
                            <Users className="size-3 text-muted-foreground" />
                            <span className="text-[11px] font-medium">{teamMap.get(id)}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedTeamIds((prev) => prev.filter((tid) => tid !== id));
                                setTeamLeadIds((prev) => prev.filter((tid) => tid !== id));
                              }}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="size-2.5" />
                            </button>
                          </div>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <span className="text-[10px] text-muted-foreground">Lead</span>
                                <Switch
                                  checked={teamLeadIds.includes(id)}
                                  onCheckedChange={(checked) =>
                                    setTeamLeadIds((prev) =>
                                      checked ? [...prev, id] : prev.filter((tid) => tid !== id),
                                    )
                                  }
                                  disabled={loading}
                                  className="scale-75"
                                />
                              </label>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                              Make this person a team lead. They can add/remove members and invite new people to this team.
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {singleActiveTeamId && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Position (optional)</Label>
                  <Select
                    value={selectedPositionId ?? "none"}
                    onValueChange={(v) => setSelectedPositionId(v === "none" ? null : v)}
                    disabled={loading}
                  >
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder="No position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No position</SelectItem>
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
                      disabled={creatingPosition}
                      className="h-8 text-xs flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreatePosition(singleActiveTeamId);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1 text-xs shrink-0"
                      disabled={creatingPosition || !newPositionName.trim()}
                      onClick={() => handleCreatePosition(singleActiveTeamId)}
                    >
                      {creatingPosition ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
                      Add
                    </Button>
                  </div>
                </div>
              )}
              <Button
                type="submit"
                disabled={loading}
                size="sm"
                className="h-9 gap-1.5 w-full"
              >
                <Send className="size-3.5" />
                {loading ? "Sending..." : "Send Invite"}
              </Button>
            </form>
          )}
        </div>
      </div>

      {/* Pending invites */}
      <div className="lg:col-span-3">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold">Pending Invitations</h2>
          {visibleInvites.length > 0 && (
            <span className="inline-flex items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
              {visibleInvites.length}
            </span>
          )}
        </div>

        {visibleInvites.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-white dark:bg-card py-12 text-center">
            <Mail className="size-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              No pending invitations
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1 flex items-center gap-1">
              <ArrowLeft className="size-3 hidden lg:inline-block" />
              Use the form to send an invite
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleInvites.map((invite) => (
              <div
                key={invite.id}
                className="group flex items-center gap-3 rounded-xl border border-border/50 bg-white dark:bg-card px-4 py-3 transition-colors hover:border-border"
              >
                <div className="flex size-8 items-center justify-center rounded-full bg-violet-500/10">
                  <Mail className="size-3.5 text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{invite.email}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 h-4 capitalize"
                    >
                      {invite.role}
                    </Badge>
                    <span className="flex items-center gap-0.5">
                      <Clock className="size-2.5" />
                      Expires{" "}
                      {formatDistanceToNow(new Date(invite.expires_at), {
                        addSuffix: true,
                      })}
                    </span>
                    {invite.can_approve && (
                      <span className="flex items-center gap-0.5 text-emerald-600">
                        <ShieldCheck className="size-2.5" />
                        Approve
                      </span>
                    )}
                    {invite.can_connect && (
                      <span className="flex items-center gap-0.5 text-blue-600">
                        <Plug className="size-2.5" />
                        Connect
                      </span>
                    )}
                    {invite.team_ids?.length > 0 && invite.team_ids.map((tid) => (
                      <span key={tid} className="flex items-center gap-0.5">
                        <Users className="size-2.5" />
                        {teamMap.get(tid) ?? "Unknown team"}
                        {invite.team_lead_ids?.includes(tid) && (
                          <span className="text-amber-600 font-semibold">(Lead)</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="shrink-0"
                      title="Revoke invite"
                    >
                      <X className="size-3.5 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will revoke the invite sent to{" "}
                        <span className="font-medium text-foreground">
                          {invite.email}
                        </span>
                        . They will no longer be able to join using this link.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleRevoke(invite.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Revoke
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
