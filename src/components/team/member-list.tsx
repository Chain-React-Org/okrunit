"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Crown, Shield, User, Trash2, Search, Download, ClipboardCopy, Check, ThumbsUp, ThumbsDown, Clock, Info } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { UserRole } from "@/lib/types/database";
import type { MemberActivityStats } from "@/components/team/team-page-tabs";

// ---- Types ----------------------------------------------------------------

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

// ---- Helpers --------------------------------------------------------------

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

const roleIcons = {
  owner: Crown,
  admin: Shield,
  member: User,
} as const;

const roleLabels = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
} as const;

const roleBadgeVariants = {
  owner: "default",
  admin: "secondary",
  member: "outline",
} as const;

const roleDescriptions = {
  owner: "Full access. Can manage billing, members, roles, and all settings. Cannot be removed.",
  admin: "Can manage members, invites, connections, webhooks, and messaging. Cannot change roles.",
  member: "Can view and act on approval requests. No management access.",
} as const;

// ---- Component ------------------------------------------------------------

interface MemberListProps {
  members: TeamMember[];
  currentUserId: string;
  currentUserRole: string;
  memberStats: Record<string, MemberActivityStats>;
  pendingLoadMap: Record<string, number>;
}

export function MemberList({
  members,
  currentUserId,
  currentUserRole,
  memberStats,
  pendingLoadMap,
}: MemberListProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TeamMember | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [copied, setCopied] = useState(false);

  const isOwner = currentUserRole === "owner";
  const canRemove = currentUserRole === "owner" || currentUserRole === "admin";

  const filteredMembers = useMemo(() => {
    let result = members;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (m) =>
          (m.full_name?.toLowerCase().includes(q)) ||
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

      toast.success("Member role updated");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setLoading(null);
    }
  }

  async function handleCanApproveChange(userId: string, canApprove: boolean) {
    setLoading(userId);
    try {
      const res = await fetch("/api/v1/team/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, can_approve: canApprove }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update approval permission");
      }
      toast.success(canApprove ? "Approval permission granted" : "Approval permission revoked");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setLoading(null);
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
      toast.error(
        err instanceof Error ? err.message : "Failed to remove member",
      );
    } finally {
      setLoading(null);
    }
  }

  function exportCsv() {
    const headers = ["Name", "Email", "Role", "Can Approve", "Decisions (30d)", "Approved", "Rejected", "Pending Load", "Last Active"];
    const rows = members.map((m) => {
      const stats = memberStats[m.id];
      const pending = pendingLoadMap[m.id] ?? 0;
      return [
        m.full_name ?? "",
        m.email,
        m.role,
        m.can_approve ? "Yes" : "No",
        stats?.decisions_30d ?? 0,
        stats?.approved ?? 0,
        stats?.rejected ?? 0,
        pending,
        stats?.last_active ? new Date(stats.last_active).toISOString() : "Never",
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

  function copyToClipboard() {
    const lines = members.map((m) => `${m.full_name ?? m.email.split("@")[0]}\t${m.email}\t${m.role}`);
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Search, filter, and export toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="owner">Owners</SelectItem>
              <SelectItem value="admin">Admins</SelectItem>
              <SelectItem value="member">Members</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={copyToClipboard} className="gap-1.5">
            {copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}
            <span className="hidden sm:inline">{copied ? "Copied" : "Copy"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv} className="gap-1.5">
            <Download className="size-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-medium">
            Members ({filteredMembers.length}{filteredMembers.length !== members.length ? ` of ${members.length}` : ""})
          </h2>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead className="hidden sm:table-cell">Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Can Approve</TableHead>
              <TableHead className="hidden lg:table-cell">Activity (30d)</TableHead>
              <TableHead className="hidden lg:table-cell">Pending</TableHead>
              <TableHead className="hidden xl:table-cell">Last Active</TableHead>
              {(isOwner || canRemove) && (
                <TableHead className="w-[80px]">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                  {search || roleFilter !== "all" ? "No members match your filters." : "No members found."}
                </TableCell>
              </TableRow>
            ) : (
              filteredMembers.map((member) => {
                const RoleIcon = roleIcons[member.role];
                const isSelf = member.id === currentUserId;
                const stats = memberStats[member.id];
                const pendingLoad = pendingLoadMap[member.id] ?? 0;

                return (
                  <TableRow key={member.id}>
                    {/* Avatar + Name */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar size="sm">
                          <AvatarFallback>
                            {getInitials(member.full_name, member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <span className="text-sm font-medium">
                            {member.full_name ?? member.email.split("@")[0]}
                            {isSelf && (
                              <span className="text-muted-foreground ml-1.5 text-xs">
                                (you)
                              </span>
                            )}
                          </span>
                          {/* Show email on mobile under name */}
                          <p className="text-muted-foreground text-xs truncate max-w-[180px] sm:hidden">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>

                    {/* Email (hidden on mobile) */}
                    <TableCell className="text-muted-foreground text-sm hidden sm:table-cell">
                      {member.email}
                    </TableCell>

                    {/* Role with tooltip */}
                    <TableCell>
                      {isOwner && !isSelf && member.role !== "owner" ? (
                        <Select
                          value={member.role}
                          onValueChange={(value) =>
                            handleRoleChange(member.id, value)
                          }
                          disabled={loading === member.id}
                        >
                          <SelectTrigger size="sm" className="w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">
                              <Shield className="mr-1.5 inline size-3.5" />
                              Admin
                            </SelectItem>
                            <SelectItem value="member">
                              <User className="mr-1.5 inline size-3.5" />
                              Member
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant={
                              roleBadgeVariants[member.role] as
                                | "default"
                                | "secondary"
                                | "outline"
                            }
                          >
                            <RoleIcon className="mr-1 size-3" />
                            {roleLabels[member.role]}
                          </Badge>
                          <span
                            title={roleDescriptions[member.role]}
                            className="text-muted-foreground cursor-help"
                          >
                            <Info className="size-3" />
                          </span>
                        </div>
                      )}
                    </TableCell>

                    {/* Can Approve */}
                    <TableCell>
                      <Switch
                        checked={member.can_approve}
                        onCheckedChange={(checked) => handleCanApproveChange(member.id, checked)}
                        disabled={loading === member.id || isSelf}
                      />
                    </TableCell>

                    {/* Activity (30d) */}
                    <TableCell className="hidden lg:table-cell">
                      {stats && stats.decisions_30d > 0 ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium">{stats.decisions_30d}</span>
                          <span className="flex items-center gap-0.5 text-green-600">
                            <ThumbsUp className="size-3" />
                            {stats.approved}
                          </span>
                          <span className="flex items-center gap-0.5 text-red-500">
                            <ThumbsDown className="size-3" />
                            {stats.rejected}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">No activity</span>
                      )}
                    </TableCell>

                    {/* Pending Load */}
                    <TableCell className="hidden lg:table-cell">
                      {pendingLoad > 0 ? (
                        <Badge variant="outline" className="gap-1 text-xs font-normal">
                          <Clock className="size-3" />
                          {pendingLoad}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Last Active */}
                    <TableCell className="hidden xl:table-cell">
                      {stats?.last_active ? (
                        <span className="text-muted-foreground text-xs" title={new Date(stats.last_active).toLocaleString()}>
                          {formatDistanceToNow(new Date(stats.last_active), { addSuffix: true })}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">Never</span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    {(isOwner || canRemove) && (
                      <TableCell>
                        {canRemove && !isSelf && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setRemoveTarget(member)}
                            disabled={loading === member.id}
                            title="Remove member"
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Remove confirmation dialog */}
      <Dialog
        open={!!removeTarget}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <strong>
                {removeTarget?.full_name ?? removeTarget?.email}
              </strong>{" "}
              from the organization? They will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={loading !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemove}
              disabled={loading !== null}
            >
              {loading ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
