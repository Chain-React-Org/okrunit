"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Crown,
  Loader2,
  Mail,
  Plus,
  Send,
  Settings2,
  Shield,
  Star,
  Trash2,
  User,
  UserMinus,
  UserPlus,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { titleCaseName } from "@/lib/format-name";
import { Button } from "@/components/ui/button";
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
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "member";
  position_id: string | null;
  is_lead: boolean;
  joined_at: string;
}

interface AvailableMember {
  id: string;
  email: string;
  full_name: string | null;
  role: "owner" | "admin" | "member";
}

interface TeamPosition {
  id: string;
  name: string;
}

interface TeamOwner {
  id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
}

interface TeamDetailProps {
  team: {
    id: string;
    name: string;
    description: string | null;
    created_at: string;
  };
  members: TeamMember[];
  availableMembers: AvailableMember[];
  positions: TeamPosition[];
  owner: TeamOwner | null;
  currentUserId: string;
  canManage: boolean;
  isOrgAdmin: boolean;
}

const roleConfig = {
  owner: { icon: Crown, label: "Owner", color: "text-amber-600", bg: "bg-amber-500/10", border: "border-amber-200" },
  admin: { icon: Shield, label: "Admin", color: "text-blue-600", bg: "bg-blue-500/10", border: "border-blue-200" },
  member: { icon: User, label: "Member", color: "text-muted-foreground", bg: "bg-muted", border: "border-border" },
} as const;

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
  }
  return email.charAt(0).toUpperCase();
}

export function TeamDetail({
  team,
  members,
  availableMembers,
  positions,
  owner,
  currentUserId,
  canManage,
  isOrgAdmin,
}: TeamDetailProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [newPositionName, setNewPositionName] = useState("");
  const [creatingPosition, setCreatingPosition] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  // ---- Add members (bulk) ------------------------------------------------

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  async function handleAddMembers() {
    if (selectedUserIds.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/teams/${team.id}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_ids: selectedUserIds }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to add members");
      }
      const result = await res.json();
      toast.success(`${result.added} member${result.added !== 1 ? "s" : ""} added`);
      setSelectedUserIds([]);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add members");
    } finally {
      setLoading(false);
    }
  }

  // ---- Remove member -----------------------------------------------------

  async function handleRemoveMember(userId: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/teams/${team.id}/members`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to remove member");
      }
      toast.success("Member removed from team");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setLoading(false);
    }
  }

  // ---- Update member position --------------------------------------------

  async function handleUpdatePosition(userId: string, positionId: string | null) {
    try {
      const res = await fetch(`/api/v1/teams/${team.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, position_id: positionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to update position");
      }
      toast.success("Position updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update position");
    }
  }

  // ---- Toggle lead status ------------------------------------------------

  async function handleToggleLead(userId: string, isLead: boolean) {
    try {
      const res = await fetch(`/api/v1/teams/${team.id}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, is_lead: isLead }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to update");
      }
      toast.success(isLead ? "Team lead assigned" : "Team lead removed");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  // ---- Manage positions --------------------------------------------------

  async function handleCreatePosition(e: React.FormEvent) {
    e.preventDefault();
    if (!newPositionName.trim()) return;
    setCreatingPosition(true);
    try {
      const res = await fetch(`/api/v1/teams/${team.id}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPositionName.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to create position");
      }
      toast.success("Position created");
      setNewPositionName("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create position");
    } finally {
      setCreatingPosition(false);
    }
  }

  async function handleDeletePosition(positionId: string) {
    try {
      const res = await fetch(`/api/v1/teams/${team.id}/positions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position_id: positionId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to delete position");
      }
      toast.success("Position deleted");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete position");
    }
  }

  // ---- Invite new person to team ------------------------------------------

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    setInviting(true);
    try {
      const res = await fetch("/api/v1/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role: "member",
          team_ids: [team.id],
          can_approve: false,
          can_connect: false,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to send invite");
      }
      toast.success(`Invitation sent to ${email}`);
      setInviteEmail("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setInviting(false);
    }
  }

  // ---- Render ------------------------------------------------------------

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/org/teams"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="size-3" />
          Back to Teams
        </Link>
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <UsersRound className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{team.name}</h1>
            {team.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{team.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Owner section */}
      <div className="rounded-xl border border-border/50 bg-[var(--card)] p-5">
        <h2 className="text-sm font-semibold mb-3">Team Owner</h2>
        {owner ? (
          <div className="flex items-center gap-3">
            <Avatar>
              {owner.avatar_url && <AvatarImage src={owner.avatar_url} alt={owner.name ?? owner.email} />}
              <AvatarFallback className="text-xs font-bold">
                {getInitials(owner.name, owner.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {owner.name ?? owner.email.split("@")[0]}
                {owner.id === currentUserId && (
                  <span className="text-muted-foreground ml-1 text-[10px]">(you)</span>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground truncate">{owner.email}</p>
            </div>
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 ml-auto shrink-0">
              <Crown className="size-3" />
              Created this team
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No owner information available</p>
        )}
      </div>

      {/* Positions configuration */}
      {canManage && (
        <div className="rounded-xl border border-border/50 bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-3">
            <Settings2 className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Positions</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Create positions like &quot;Lead&quot;, &quot;Reviewer&quot;, or &quot;On-Call&quot; to assign to team members.
          </p>

          {positions.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {positions.map((pos) => (
                <Badge key={pos.id} variant="secondary" className="gap-1 pr-1">
                  {pos.name}
                  <button
                    type="button"
                    className="rounded-full p-0.5 hover:bg-muted-foreground/20 cursor-pointer"
                    onClick={() => handleDeletePosition(pos.id)}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <form onSubmit={handleCreatePosition} className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                placeholder="New position name..."
                value={newPositionName}
                onChange={(e) => setNewPositionName(e.target.value)}
                maxLength={100}
                disabled={creatingPosition}
                className="h-9"
              />
            </div>
            <Button
              type="submit"
              size="sm"
              className="h-9 gap-1.5"
              disabled={creatingPosition || !newPositionName.trim()}
            >
              <Plus className="size-3.5" />
              Add
            </Button>
          </form>
        </div>
      )}

      {/* Add members section - multi-select */}
      {canManage && availableMembers.length > 0 && (
        <div className="rounded-xl border border-border/50 bg-[var(--card)] p-5">
          <h2 className="text-sm font-semibold mb-1">Add Members</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Select one or more organization members to add. They will receive an email notification.
          </p>

          {/* Selected badges */}
          {selectedUserIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {selectedUserIds.map((uid) => {
                const m = availableMembers.find((am) => am.id === uid);
                return (
                  <Badge key={uid} variant="secondary" className="gap-1 pr-1">
                    {titleCaseName(m?.full_name) ?? m?.email.split("@")[0] ?? uid.slice(0, 8)}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-muted-foreground/20 cursor-pointer"
                      onClick={() => toggleUser(uid)}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Member checklist */}
          <div className="max-h-48 overflow-y-auto rounded-md border mb-3">
            {availableMembers.map((m) => (
              <label
                key={m.id}
                className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-accent"
              >
                <Checkbox
                  checked={selectedUserIds.includes(m.id)}
                  onCheckedChange={() => toggleUser(m.id)}
                  disabled={loading}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">
                    {titleCaseName(m.full_name) ?? m.email.split("@")[0]}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{m.email}</div>
                </div>
              </label>
            ))}
          </div>

          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleAddMembers}
            disabled={loading || selectedUserIds.length === 0}
          >
            <UserPlus className="size-3.5" />
            {loading
              ? "Adding..."
              : `Add ${selectedUserIds.length} member${selectedUserIds.length !== 1 ? "s" : ""}`}
          </Button>
        </div>
      )}

      {/* Invite new person */}
      {canManage && (
        <div className="rounded-xl border border-border/50 bg-[var(--card)] p-5">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Invite Someone New</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Invite someone who isn&apos;t in the organization yet. They&apos;ll be added to this team when they accept.
          </p>
          <form onSubmit={handleInvite} className="flex items-end gap-2">
            <div className="flex-1">
              <div className="relative">
                <Mail className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviting}
                  className="pl-9 h-9"
                  required
                />
              </div>
            </div>
            <Button
              type="submit"
              size="sm"
              className="h-9 gap-1.5"
              disabled={inviting || !inviteEmail.trim()}
            >
              {inviting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="size-3.5" />
                  Invite
                </>
              )}
            </Button>
          </form>
        </div>
      )}

      {/* Members list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Members</h2>
          <Badge variant="secondary" className="text-[11px] gap-1">
            <Users className="size-3" />
            {members.length} member{members.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {members.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-[var(--card)] py-12">
            <Users className="text-muted-foreground/30 mb-2 size-8" />
            <p className="text-sm text-muted-foreground">No members in this team yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Add organization members to this team above
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {members.map((member) => {
              const rc = roleConfig[member.role];
              const RoleIcon = rc.icon;
              const position = positions.find((p) => p.id === member.position_id);

              return (
                <div
                  key={member.id}
                  className="group flex items-center gap-4 rounded-xl border border-border/50 bg-[var(--card)] px-5 py-4 transition-colors hover:border-border"
                >
                  {/* Avatar */}
                  <Avatar>
                    {member.avatar_url && <AvatarImage src={member.avatar_url} alt={member.full_name ?? member.email} />}
                    <AvatarFallback className="text-xs font-bold">
                      {getInitials(member.full_name, member.email)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">
                        {titleCaseName(member.full_name) ?? member.email.split("@")[0]}
                      </p>
                      {member.id === currentUserId && (
                        <span className="text-[10px] text-muted-foreground">(you)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`inline-flex items-center gap-1 rounded-md border ${rc.border} ${rc.bg} px-2 py-0.5 text-[11px] font-medium ${rc.color}`}>
                        <RoleIcon className="size-3" />
                        {rc.label}
                      </span>
                      {member.is_lead && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                          <Star className="size-3" />
                          Lead
                        </span>
                      )}
                      {position && (
                        <Badge variant="outline" className="text-[11px]">
                          {position.name}
                        </Badge>
                      )}
                      <span className="text-[11px] text-muted-foreground truncate">
                        {member.email}
                      </span>
                    </div>
                  </div>

                  {/* Position selector + remove */}
                  {canManage && (
                    <div className="flex items-center gap-2 shrink-0">
                      {isOrgAdmin && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                              <span className="text-[10px] text-muted-foreground">Lead</span>
                              <Switch
                                checked={member.is_lead}
                                onCheckedChange={(checked) => handleToggleLead(member.id, checked)}
                                disabled={loading}
                                className="scale-75"
                              />
                            </label>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            Team leads can add/remove members and invite new people to this team.
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {positions.length > 0 && (
                        <Select
                          value={member.position_id ?? "none"}
                          onValueChange={(v) =>
                            handleUpdatePosition(member.id, v === "none" ? null : v)
                          }
                        >
                          <SelectTrigger className="h-8 w-[130px] text-xs">
                            <SelectValue placeholder="Position" />
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
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={loading}
                        title="Remove from team"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <UserMinus className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
