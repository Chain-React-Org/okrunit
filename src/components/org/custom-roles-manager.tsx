"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Shield,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import type { CustomRole } from "@/lib/types/database";

const BASE_ROLE_CONFIG = {
  member: { label: "Member", description: "Can view approvals", icon: User, color: "text-zinc-500" },
  approver: { label: "Approver", description: "Can view and approve/reject", icon: ShieldCheck, color: "text-blue-500" },
  admin: { label: "Admin", description: "Can manage org settings, connections, rules", icon: Shield, color: "text-violet-500" },
};

const ROLE_COLORS = [
  { value: "#6b7280", label: "Gray" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#10b981", label: "Emerald" },
  { value: "#ef4444", label: "Red" },
  { value: "#06b6d4", label: "Cyan" },
];

interface CustomRolesManagerProps {
  initialRoles: CustomRole[];
  canManage?: boolean;
}

export function CustomRolesManager({ initialRoles, canManage = true }: CustomRolesManagerProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomRole | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [baseRole, setBaseRole] = useState<"member" | "approver" | "admin">("approver");
  const [color, setColor] = useState("#6b7280");
  const [canApprove, setCanApprove] = useState(true);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setBaseRole("approver");
    setColor("#6b7280");
    setCanApprove(true);
    setDialogOpen(true);
  }

  function openEdit(role: CustomRole) {
    setEditing(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setBaseRole(role.base_role);
    setColor(role.color);
    setCanApprove(role.can_approve);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const url = editing ? `/api/v1/custom-roles/${editing.id}` : "/api/v1/custom-roles";
      const method = editing ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          base_role: baseRole,
          color,
          can_approve: canApprove,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save");
      }

      toast.success(editing ? "Role updated" : "Role created");
      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/v1/custom-roles/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Role deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete role");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-primary mb-0.5">Organization</p>
          <h1 className="text-xl font-semibold tracking-tight">Custom Roles</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define custom roles that map to permission levels. Assign them to members for clearer team structure.
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={openCreate} className="gap-1.5 h-8">
            <Plus className="size-3.5" />
            New Role
          </Button>
        )}
      </div>

      {/* Built-in roles reference */}
      <div className="rounded-xl border border-border/50 bg-[var(--card)] p-4">
        <p className="text-xs font-medium text-muted-foreground mb-3">Built-in Permission Levels</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(Object.entries(BASE_ROLE_CONFIG) as [string, typeof BASE_ROLE_CONFIG.member][]).map(
            ([key, config]) => {
              const Icon = config.icon;
              return (
                <div key={key} className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2">
                  <Icon className={cn("size-4", config.color)} />
                  <div>
                    <p className="text-xs font-medium">{config.label}</p>
                    <p className="text-[10px] text-muted-foreground">{config.description}</p>
                  </div>
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* Custom roles list */}
      {initialRoles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-16 text-center">
          <Users className="size-8 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No custom roles</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Create roles like &quot;Security Reviewer&quot; or &quot;Finance Approver&quot; to organize your team.
          </p>
          {canManage && (
            <Button size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
              <Plus className="size-3.5" />
              Create Role
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {initialRoles.map((role) => {
            const baseConfig = BASE_ROLE_CONFIG[role.base_role];
            const BaseIcon = baseConfig.icon;

            return (
              <div
                key={role.id}
                className="group flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3 transition-colors hover:border-border"
              >
                {/* Color dot */}
                <div
                  className="size-3 rounded-full shrink-0"
                  style={{ backgroundColor: role.color }}
                />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{role.name}</h3>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <BaseIcon className={cn("size-2.5", baseConfig.color)} />
                      {baseConfig.label} permissions
                    </Badge>
                    {role.can_approve && (
                      <Badge variant="outline" className="text-[10px]">Can approve</Badge>
                    )}
                  </div>
                  {role.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{role.description}</p>
                  )}
                </div>

                {/* Actions */}
                {canManage && (
                  <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(role)}>
                      <Pencil className="size-3.5 text-muted-foreground" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => handleDelete(role.id)}
                      disabled={deleting === role.id}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Role" : "Create Custom Role"}</DialogTitle>
            <DialogDescription>
              Custom roles have a display name and map to a base permission level.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Role Name</Label>
              <Input
                placeholder="e.g. Security Reviewer"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Optional description..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Base Permission Level</Label>
              <Select value={baseRole} onValueChange={(v) => {
                const role = v as "member" | "approver" | "admin";
                setBaseRole(role);
                setCanApprove(role !== "member");
              }}>
                <SelectTrigger className="bg-white dark:bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member - can view approvals</SelectItem>
                  <SelectItem value="approver">Approver - can approve/reject</SelectItem>
                  <SelectItem value="admin">Admin - can manage settings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {ROLE_COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    className={cn(
                      "size-7 rounded-full border-2 transition-all",
                      color === c.value ? "border-foreground scale-110" : "border-transparent",
                    )}
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label>Can approve requests</Label>
              <Switch checked={canApprove} onCheckedChange={setCanApprove} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? "Saving..." : editing ? "Save Changes" : "Create Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
