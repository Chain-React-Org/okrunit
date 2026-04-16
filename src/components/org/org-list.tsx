"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  Crown,
  Loader2,
  Pencil,
  Plus,
  Shield,
  Trash2,
  User,
  Users,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useOrgName } from "@/components/org/org-name-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { checkMfaRequired, verifyMfaCode } from "@/lib/mfa";

interface OrgItem {
  id: string;
  org_id: string;
  org_name: string;
  role: string;
  is_default: boolean;
}

interface OrgListProps {
  orgs: OrgItem[];
  currentOrgId: string;
  memberCounts: Record<string, number>;
  teamCounts: Record<string, number>;
  canCreateOrg?: boolean;
  maxOrganizations?: number;
  planName?: string;
}

export function OrgList({ orgs: serverOrgs, currentOrgId, memberCounts, teamCounts, canCreateOrg = true, maxOrganizations, planName }: OrgListProps) {
  const router = useRouter();
  const [switching, setSwitching] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [optimisticOrgs, setOptimisticOrgs] = useState<OrgItem[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<OrgItem | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | undefined>();
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const editRef = useRef<HTMLHeadingElement>(null);
  const { getOrgName, setOrgName, isOrgDeleted, deleteOrg } = useOrgName();

  // Apply optimistic name overrides, merge created orgs, filter deleted orgs
  const mergedOrgs = [...serverOrgs, ...optimisticOrgs.filter(
    (o) => !serverOrgs.some((s) => s.org_id === o.org_id)
  )].filter((o) => !isOrgDeleted(o.org_id));
  const orgs = mergedOrgs.map((org) => ({
    ...org,
    org_name: getOrgName(org.org_id, org.org_name),
  }));

  async function handleSwitch(orgId: string) {
    if (orgId === currentOrgId) return;
    setSwitching(orgId);
    try {
      const res = await fetch("/api/v1/org/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to switch organization");
      }
      toast.success("Switched organization");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to switch");
    } finally {
      setSwitching(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/org/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to create organization");
      }
      const created = data.data;
      setOptimisticOrgs((prev) => [...prev, {
        id: created.id,
        org_id: created.id,
        org_name: created.name,
        role: "owner",
        is_default: false,
      }]);
      toast.success("Organization created");
      setCreateOpen(false);
      setNewName("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setCreating(false);
    }
  }

  function startEditing(org: OrgItem) {
    setEditingOrgId(org.org_id);
  }

  function cancelEditing(org: OrgItem) {
    if (editRef.current) {
      editRef.current.textContent = org.org_name;
    }
    setEditingOrgId(null);
  }

  // Focus and place cursor at end when editing starts
  useEffect(() => {
    if (editingOrgId && editRef.current) {
      const el = editRef.current;
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(el);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editingOrgId]);

  function handleRename(orgId: string, originalName: string) {
    const trimmed = (editRef.current?.textContent ?? "").trim();
    if (!trimmed || trimmed === originalName) {
      if (editRef.current) editRef.current.textContent = originalName;
      setEditingOrgId(null);
      return;
    }

    // Update the DOM text immediately so contentEditable shows the new name
    if (editRef.current) {
      editRef.current.textContent = trimmed;
    }

    // Optimistic: update UI everywhere (header, sidebar, this list) immediately
    setOrgName(orgId, trimmed);
    setEditingOrgId(null);

    // Save in background
    const needSwitch = orgId !== currentOrgId;

    (async () => {
      try {
        if (needSwitch) {
          const switchRes = await fetch("/api/v1/org/switch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ org_id: orgId }),
          });
          if (!switchRes.ok) throw new Error("Failed to switch organization");
        }

        const res = await fetch("/api/v1/org", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error ?? "Failed to rename organization");
        }

        if (needSwitch) {
          await fetch("/api/v1/org/switch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ org_id: currentOrgId }),
          });
        }

        // Keep override in place. router.refresh() will bring matching server data.
        // Override is harmless since it matches what the server now has.
        router.refresh();
      } catch (err) {
        // Revert on failure. Set override back to original name.
        setOrgName(orgId, originalName);
        toast.error(err instanceof Error ? err.message : "Failed to rename");
      }
    })();
  }

  async function openDeleteDialog(org: OrgItem) {
    setDeleteTarget(org);
    setConfirmName("");
    setTotpCode("");
    setMfaRequired(false);
    setMfaFactorId(undefined);

    // Check if user has MFA enabled
    const supabase = createClient();
    const mfa = await checkMfaRequired(supabase);
    if (mfa.required && mfa.factorId) {
      setMfaRequired(true);
      setMfaFactorId(mfa.factorId);
    } else {
      // Also check if already at AAL2 (MFA enrolled and verified this session)
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (data?.currentLevel === "aal2") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totpFactor = factors?.totp?.find((f) => f.status === "verified");
        if (totpFactor) {
          setMfaRequired(true);
          setMfaFactorId(totpFactor.id);
        }
      }
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    if (confirmName.trim() !== deleteTarget.org_name) return;
    if (mfaRequired && !totpCode.trim()) return;

    setDeleting(true);
    try {
      // Verify TOTP if required
      if (mfaRequired && mfaFactorId) {
        const supabase = createClient();
        const result = await verifyMfaCode(supabase, mfaFactorId, totpCode.trim());
        if (result.error) {
          toast.error(result.error);
          setDeleting(false);
          return;
        }
      }

      const res = await fetch(`/api/v1/org/${deleteTarget.org_id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to delete organization");
      }

      deleteOrg(deleteTarget.org_id);
      if (data?.switched_to) {
        toast.success("Organization deleted. Switched to another organization.");
      } else {
        toast.success("Organization deleted");
      }
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete organization");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary mb-0.5">Account</p>
          <h1 className="text-xl font-semibold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {orgs.length} organization{orgs.length !== 1 ? "s" : ""} · Your active organization is remembered across sessions
          </p>
        </div>
        {canCreateOrg ? (
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 h-8">
            <Plus className="size-3.5" />
            New Organization
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0}>
                <Button size="sm" disabled className="gap-1.5 h-8">
                  <Plus className="size-3.5" />
                  New Organization
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{planName ?? "Your"} plan is limited to {maxOrganizations} organization{maxOrganizations !== 1 ? "s" : ""}.</p>
              <p className="text-xs text-muted-foreground">Upgrade to create more.</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Org list */}
      <div className="grid gap-3">
        {orgs.map((org) => {
          const isActive = org.org_id === currentOrgId;
          const isEditing = editingOrgId === org.org_id;
          const isSwitching = switching === org.org_id;
          const isOptimistic = optimisticOrgs.some((o) => o.org_id === org.org_id);
          const members = memberCounts[org.org_id] ?? (isOptimistic ? 1 : 0);
          const teams = teamCounts[org.org_id] ?? (isOptimistic ? 1 : 0);

          return (
            <div
              key={org.id}
              className={`group relative flex items-center gap-4 rounded-xl border bg-[var(--card)] px-5 py-4 transition-colors ${
                isActive
                  ? "border-primary/30 shadow-[var(--shadow-card)]"
                  : "border-border/50 hover:border-border"
              }`}
            >
              {/* Org icon */}
              <div className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${
                isActive ? "bg-primary/10" : "bg-muted"
              }`}>
                <Building2 className={`size-5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              </div>

              {/* Org info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3
                    ref={isEditing ? editRef : undefined}
                    contentEditable={isEditing}
                    suppressContentEditableWarning
                    spellCheck={false}
                    onBlur={isEditing ? () => handleRename(org.org_id, org.org_name) : undefined}
                    onKeyDown={isEditing ? (e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleRename(org.org_id, org.org_name);
                      }
                      if (e.key === "Escape") {
                        cancelEditing(org);
                      }
                    } : undefined}
                    style={isEditing ? { textDecoration: 'underline', textDecorationColor: '#16a34a', textUnderlineOffset: '4px', textDecorationThickness: '2px', outline: 'none' } : undefined}
                    className="text-sm font-semibold truncate"
                  >
                    {org.org_name}
                  </h3>
                  {isActive && (
                    <Badge variant="default" className="text-[10px] gap-1 shrink-0">
                      <Check className="size-2.5" />
                      Active
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {org.role === "owner" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600">
                      <Crown className="size-3" />
                      Owner
                    </span>
                  )}
                  {org.role === "admin" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-500/10 px-2 py-0.5 text-[11px] font-medium text-blue-600">
                      <Shield className="size-3" />
                      Admin
                    </span>
                  )}
                  {org.role === "member" && (
                    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      <User className="size-3" />
                      Member
                    </span>
                  )}
                  <Badge variant="secondary" className="text-[11px] gap-1">
                    <Users className="size-3" />
                    {members} member{members !== 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="secondary" className="text-[11px] gap-1">
                    <UsersRound className="size-3" />
                    {teams} team{teams !== 1 ? "s" : ""}
                  </Badge>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {(org.role === "owner" || org.role === "admin") && (
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={() => startEditing(org)}
                    title="Rename organization"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                )}
                {org.role === "owner" && orgs.length > 1 ? (
                  <button
                    type="button"
                    className="rounded-md p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={() => openDeleteDialog(org)}
                    title="Delete organization"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="rounded-md p-1.5 cursor-default opacity-0 group-hover:opacity-100" tabIndex={0}>
                        <Trash2 className="size-3.5 text-muted-foreground/30" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p>
                        {org.role !== "owner"
                          ? "Only the organization owner can delete it"
                          : "Cannot delete your only organization"}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                )}
                {!isActive && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 ml-1"
                    onClick={() => handleSwitch(org.org_id)}
                    disabled={isSwitching || switching !== null}
                  >
                    {isSwitching ? "Switching..." : "Switch"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Organization Dialog */}
      <Dialog open={createOpen} onOpenChange={(open) => { if (!open) { setCreateOpen(false); setNewName(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Organization</DialogTitle>
            <DialogDescription>
              Create a new organization. You will be the owner and can invite members later.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-org-name">Organization Name</Label>
              <Input
                id="new-org-name"
                placeholder="e.g. Acme Corp"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                maxLength={100}
                required
                disabled={creating}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" variant="success" disabled={creating || !newName.trim()}>
                {creating ? "Creating..." : "Create Organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Organization Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setConfirmName(""); setTotpCode(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget?.org_name}</strong> and all of its teams, members, API keys, approval requests, and billing data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="confirm-org-name">
                Type <strong>{deleteTarget?.org_name}</strong> to confirm
              </Label>
              <Input
                id="confirm-org-name"
                placeholder="Organization name"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                disabled={deleting}
                autoFocus
              />
            </div>
            {mfaRequired && (
              <div className="space-y-2">
                <Label htmlFor="totp-code">Two-factor authentication code</Label>
                <Input
                  id="totp-code"
                  placeholder="123456"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  maxLength={6}
                  disabled={deleting}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={
                  deleting ||
                  confirmName.trim() !== deleteTarget?.org_name ||
                  (mfaRequired && totpCode.length < 6)
                }
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                {deleting ? "Deleting..." : "Delete Organization"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
