"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Trash2,
  Users,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { BillingPlan } from "@/lib/types/database";
import { PLAN_LIMITS, isUnlimited } from "@/lib/billing/plans";

interface TeamData {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface V2TeamListProps {
  teams: TeamData[];
  memberCounts: Record<string, number>;
  currentUserRole: string;
  currentPlan: BillingPlan;
}

export function V2TeamList({
  teams: initialTeams,
  memberCounts: initialMemberCounts,
  currentUserRole,
  currentPlan,
}: V2TeamListProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editTeam, setEditTeam] = useState<TeamData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TeamData | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const canManage = currentUserRole === "owner" || currentUserRole === "admin";
  const planLimits = PLAN_LIMITS[currentPlan];
  const atTeamLimit = !isUnlimited(planLimits.maxTeams) && initialTeams.length >= planLimits.maxTeams;

  function openCreateDialog() {
    setName("");
    setDescription("");
    setCreateDialogOpen(true);
  }

  function openEditDialog(team: TeamData) {
    setName(team.name);
    setDescription(team.description ?? "");
    setEditTeam(team);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create team");
      }
      toast.success("Team created");
      setCreateDialogOpen(false);
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create team");
    } finally {
      setLoading(false);
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTeam) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/teams/${editTeam.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update team");
      }
      toast.success("Team updated");
      setEditTeam(null);
      setName("");
      setDescription("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update team");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/teams/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete team");
      }
      toast.success("Team deleted");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete team");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header - matches org page style */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary mb-0.5">Organization</p>
          <h1 className="text-xl font-semibold tracking-tight">Teams</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {initialTeams.length} team{initialTeams.length !== 1 ? "s" : ""} in this organization
          </p>
        </div>
        {canManage && (
          atTeamLimit ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>
                  <Button size="sm" disabled className="gap-1.5 h-8">
                    <Plus className="size-3.5" />
                    New Team
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                You have reached the limit for the number of teams in your organization. Upgrade to create more.
              </TooltipContent>
            </Tooltip>
          ) : (
            <Button size="sm" onClick={openCreateDialog} className="gap-1.5 h-8">
              <Plus className="size-3.5" />
              New Team
            </Button>
          )
        )}
      </div>

      {/* Team list */}
      {initialTeams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-[var(--card)] py-16">
          <UsersRound className="text-muted-foreground/30 mb-3 size-10" />
          <p className="text-sm text-muted-foreground">No teams yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create a team to group members for approval routing</p>
          {canManage && !atTeamLimit && (
            <Button size="sm" className="mt-4 gap-1.5" onClick={openCreateDialog}>
              <Plus className="size-3.5" />
              Create Team
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {initialTeams.map((team) => {
            const memberCount = initialMemberCounts[team.id] ?? 0;

            return (
              <Link
                key={team.id}
                href={`/org/teams/${team.id}`}
                className="group relative flex items-center gap-4 rounded-xl border border-border/50 bg-[var(--card)] px-5 py-4 transition-colors hover:border-border"
              >
                {/* Team icon */}
                <div className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <UsersRound className="size-5 text-primary" />
                </div>

                {/* Team info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{team.name}</h3>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[11px] gap-1">
                      <Users className="size-3" />
                      {memberCount} member{memberCount !== 1 ? "s" : ""}
                    </Badge>
                    {team.description && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        {team.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions - visible on hover */}
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditDialog(team); }}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setDeleteTarget(team); }}
                      className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {/* Create Team Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={(open) => { if (!open) { setCreateDialogOpen(false); setName(""); setDescription(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Team</DialogTitle>
            <DialogDescription>Create a new team to group members for approval routing.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-team-name">Name</Label>
              <Input id="create-team-name" placeholder="e.g. Engineering" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-team-description">Description</Label>
              <Textarea id="create-team-description" placeholder="Optional description..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} disabled={loading} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading || !name.trim()}>{loading ? "Creating..." : "Create Team"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Team Dialog */}
      <Dialog open={!!editTeam} onOpenChange={(open) => { if (!open) { setEditTeam(null); setName(""); setDescription(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Team</DialogTitle>
            <DialogDescription>Update the team name and description.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Name</Label>
              <Input id="edit-team-name" placeholder="e.g. Engineering" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-description">Description</Label>
              <Textarea id="edit-team-description" placeholder="Optional description..." value={description} onChange={(e) => setDescription(e.target.value)} maxLength={500} rows={3} disabled={loading} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTeam(null)} disabled={loading}>Cancel</Button>
              <Button type="submit" disabled={loading || !name.trim()}>{loading ? "Saving..." : "Save Changes"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? All team memberships will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={loading}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>{loading ? "Deleting..." : "Delete Team"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
