"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Crown,
  Shield,
  User,
  Trash2,
  Search,
  Download,
  Check,
  ThumbsUp,
  ThumbsDown,
  Clock,
  MoreHorizontal,
  ShieldCheck,
  ShieldOff,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import type { UserRole } from "@/lib/types/database";
import type { MemberActivityStats } from "@/components/team/team-page-tabs";

interface TeamMember {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: UserRole;
  can_approve: boolean;
  created_at: string;
  updated_at: string;
}

function getInitials(name: string | null, email: string): string {
  if (name) {
    return name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email.charAt(0).toUpperCase();
}

const roleConfig = {
  owner: { icon: Crown, label: "Owner", color: "text-foreground", bg: "bg-white" },
  admin: { icon: Shield, label: "Admin", color: "text-foreground", bg: "bg-white" },
  member: { icon: User, label: "Member", color: "text-foreground", bg: "bg-white" },
} as const;

interface V2MemberListProps {
  members: TeamMember[];
  currentUserId: string;
  currentUserRole: string;
  memberStats: Record<string, MemberActivityStats>;
  pendingLoadMap: Record<string, number>;
}

export function V2MemberList({
  members,
  currentUserId,
  currentUserRole,
  memberStats,
  pendingLoadMap,
}: V2MemberListProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [optimisticApprove, setOptimisticApprove] = useState<Record<string, boolean>>({});

  const isOwner = currentUserRole === "owner";
  const canRemove = currentUserRole === "owner" || currentUserRole === "admin";

  const filteredMembers = useMemo(() => {
    let result = members;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          m.full_name?.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q),
      );
    }
    if (roleFilter !== "all") {
      result = result.filter((m) => m.role === roleFilter);
    }
    return result;
  }, [members, search, roleFilter]);

  async function handleRoleChange(userId: string, newRole: string) {
    setLoading(userId);
    try {
      const res = await fetch("/api/v1/team/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update role");
      }
      toast.success("Role updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setLoading(null);
    }
  }

  async function handleCanApproveChange(userId: string, canApprove: boolean) {
    // Optimistic update — toggle immediately
    setOptimisticApprove((prev) => ({ ...prev, [userId]: canApprove }));
    toast.success(canApprove ? "Approval permission granted" : "Approval permission revoked");

    try {
      const res = await fetch("/api/v1/team/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, can_approve: canApprove }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update");
      }
      router.refresh();
    } catch (err) {
      // Revert on failure
      setOptimisticApprove((prev) => ({ ...prev, [userId]: !canApprove }));
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  async function handleRemove() {
    if (!removeTarget) return;
    setLoading(removeTarget.id);
    try {
      const res = await fetch("/api/v1/team/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: removeTarget.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remove member");
      }
      toast.success("Member removed");
      setRemoveTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove member");
    } finally {
      setLoading(null);
    }
  }

  function exportCsv() {
    const headers = ["Name", "Email", "Role", "Can Approve", "Decisions (30d)", "Approved", "Rejected"];
    const rows = members.map((m) => {
      const stats = memberStats[m.id];
      return [
        m.full_name ?? "",
        m.email,
        m.role,
        m.can_approve ? "Yes" : "No",
        stats?.decisions_30d ?? 0,
        stats?.approved ?? 0,
        stats?.rejected ?? 0,
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "team-members.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { owner: 0, admin: 0, member: 0 };
    members.forEach((m) => { counts[m.role]++; });
    return counts;
  }, [members]);

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-xs">
            <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 !bg-white !shadow-none"
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-white p-0.5">
            {[
              { value: "all", label: "All" },
              { value: "owner", label: "Owners" },
              { value: "admin", label: "Admins" },
              { value: "member", label: "Members" },
            ].map((filter) => (
              <button
                key={filter.value}
                onClick={() => setRoleFilter(filter.value)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  roleFilter === filter.value
                    ? "bg-white text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label}
                {filter.value !== "all" && (
                  <span className="ml-1 opacity-60">{roleCounts[filter.value]}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5 h-9 bg-white text-foreground hover:bg-white/80">
          <Download className="size-3.5" />
          Export
        </Button>
      </div>

      {/* Member count */}
      <p className="text-xs text-muted-foreground mb-3">
        {filteredMembers.length} member{filteredMembers.length !== 1 ? "s" : ""}
        {filteredMembers.length !== members.length && ` of ${members.length}`}
      </p>

      {/* Member cards */}
      {filteredMembers.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12">
          <User className="size-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">
            {search || roleFilter !== "all" ? "No members match your filters" : "No members found"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredMembers.map((member) => {
            const config = roleConfig[member.role];
            const RoleIcon = config.icon;
            const isSelf = member.id === currentUserId;
            const stats = memberStats[member.id];
            const pendingLoad = pendingLoadMap[member.id] ?? 0;

            return (
              <div
                key={member.id}
                className="group flex items-center gap-4 rounded-xl border border-border/50 px-4 py-3 transition-colors hover:border-border hover:bg-muted/20"
              >
                {/* Avatar */}
                <Avatar size="sm">
                  <AvatarFallback className="text-xs font-medium">
                    {getInitials(member.full_name, member.email)}
                  </AvatarFallback>
                </Avatar>

                {/* Name & email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {member.full_name ?? member.email.split("@")[0]}
                    </p>
                    {isSelf && (
                      <span className="shrink-0 text-[10px] font-medium text-foreground bg-white shadow-sm px-1.5 py-0.5 rounded">you</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                </div>

                {/* Activity stats */}
                <div className="hidden lg:flex items-center gap-3 shrink-0">
                  {stats && stats.decisions_30d > 0 ? (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-0.5 text-emerald-600">
                        <ThumbsUp className="size-3" />
                        {stats.approved}
                      </span>
                      <span className="flex items-center gap-0.5 text-red-500">
                        <ThumbsDown className="size-3" />
                        {stats.rejected}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground/40">No activity</span>
                  )}
                  {pendingLoad > 0 && (
                    <span className="flex items-center gap-0.5 rounded-md bg-white px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                      <Clock className="size-3" />
                      {pendingLoad}
                    </span>
                  )}
                </div>

                {/* Can approve toggle */}
                {(() => {
                  const canApproveValue = optimisticApprove[member.id] ?? member.can_approve;
                  return (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="hidden sm:flex items-center gap-2 shrink-0 cursor-default">
                          <span>
                            {canApproveValue ? (
                              <ShieldCheck className="size-3.5 text-emerald-500" />
                            ) : (
                              <ShieldOff className="size-3.5 text-muted-foreground/40" />
                            )}
                          </span>
                          <Switch
                            checked={canApproveValue}
                            onCheckedChange={(checked) => handleCanApproveChange(member.id, checked)}
                            disabled={isSelf}
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {canApproveValue
                          ? "This member can approve or reject requests. Toggle off to revoke."
                          : "This member cannot approve requests. Toggle on to grant permission."}
                      </TooltipContent>
                    </Tooltip>
                  );
                })()}

                {/* Role */}
                <div className="shrink-0">
                  {isOwner && !isSelf && member.role !== "owner" ? (
                    <Select
                      value={member.role}
                      onValueChange={(value) => handleRoleChange(member.id, value)}
                      disabled={loading === member.id}
                    >
                      <SelectTrigger size="sm" className="w-[120px] h-8 text-xs !bg-white !text-foreground !border-transparent !shadow-none">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">
                          <Shield className="mr-1.5 inline size-3" />
                          Admin
                        </SelectItem>
                        <SelectItem value="member">
                          <User className="mr-1.5 inline size-3" />
                          Member
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium ${config.bg} ${config.color}`}>
                      <RoleIcon className="size-3" />
                      {config.label}
                    </span>
                  )}
                </div>

                {/* Remove */}
                {canRemove && !isSelf && member.role !== "owner" && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setRemoveTarget(member)}
                    disabled={loading === member.id}
                    className="shrink-0"
                    title="Remove member"
                  >
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Remove confirmation dialog */}
      <Dialog open={!!removeTarget} onOpenChange={(open) => { if (!open) setRemoveTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <strong>{removeTarget?.full_name ?? removeTarget?.email}</strong>{" "}
              from the organization? They will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)} disabled={loading !== null}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove} disabled={loading !== null}>
              {loading ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
