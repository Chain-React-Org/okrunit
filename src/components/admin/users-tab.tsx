"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Admin Users Tab
// Table of all users with create, edit, and delete capabilities.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  Search,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { UserWithMemberships, OrgWithCounts } from "@/lib/admin-types";

interface UsersTabProps {
  users: UserWithMemberships[];
  organizations?: OrgWithCounts[];
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

export function UsersTab({ users, organizations = [] }: UsersTabProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createIsAdmin, setCreateIsAdmin] = useState(false);
  const [createOrgId, setCreateOrgId] = useState<string>("");
  const [createRole, setCreateRole] = useState<string>("member");

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editUser, setEditUser] = useState<UserWithMemberships | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsAdmin, setEditIsAdmin] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteUser, setDeleteUser] = useState<UserWithMemberships | null>(null);

  const filtered = users.filter(
    (user) =>
      user.email.toLowerCase().includes(search.toLowerCase()) ||
      (user.full_name ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  // ---- Create ----

  function resetCreateForm() {
    setCreateEmail("");
    setCreateName("");
    setCreateIsAdmin(false);
    setCreateOrgId("");
    setCreateRole("member");
  }

  async function handleCreate() {
    if (!createEmail.trim()) {
      toast.error("Email is required.");
      return;
    }
    setCreateLoading(true);
    try {
      const body: Record<string, unknown> = {
        email: createEmail.trim(),
        is_app_admin: createIsAdmin,
      };
      if (createName.trim()) body.full_name = createName.trim();
      if (createOrgId) {
        body.org_id = createOrgId;
        body.role = createRole;
      }

      const res = await fetch("/api/v1/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create user");
      }

      toast.success(`User ${createEmail.trim()} created.`);
      setCreateOpen(false);
      resetCreateForm();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreateLoading(false);
    }
  }

  // ---- Edit ----

  function openEdit(user: UserWithMemberships) {
    setEditUser(user);
    setEditName(user.full_name ?? "");
    setEditIsAdmin(user.is_app_admin);
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editUser) return;
    setEditLoading(true);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: editUser.id,
          full_name: editName.trim() || editUser.full_name,
          is_app_admin: editIsAdmin,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to update user");
      }

      toast.success("User updated.");
      setEditOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setEditLoading(false);
    }
  }

  // ---- Delete ----

  function openDelete(user: UserWithMemberships) {
    setDeleteUser(user);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteUser) return;
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/v1/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: deleteUser.id }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to delete user");
      }

      toast.success(`User ${deleteUser.email} deleted.`);
      setDeleteOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">All Users</h3>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-[220px] pl-8 text-sm"
            />
          </div>
          <span className="text-muted-foreground text-sm">
            {filtered.length} of {users.length}
          </span>
          <Button
            size="sm"
            onClick={() => { resetCreateForm(); setCreateOpen(true); }}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            Create User
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border py-16 text-center">
          <p className="text-sm">
            {search ? "No users match your search." : "No users found."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white dark:bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Organizations</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow
                  key={user.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  {/* User with avatar */}
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar size="sm">
                        <AvatarFallback>
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {user.full_name ?? user.email}
                        </p>
                        {user.full_name && (
                          <p className="truncate text-xs text-muted-foreground">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>

                  {/* Organizations */}
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {user.memberships.length === 0 ? (
                        <span className="text-muted-foreground text-xs italic">
                          No organizations
                        </span>
                      ) : (
                        user.memberships.map((m) => (
                          <Badge
                            key={m.org_id}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-accent transition-colors"
                            onClick={() => router.push(`/admin/organizations?highlight=${m.org_id}`)}
                          >
                            {m.org_name}
                            <span className="ml-1 text-muted-foreground">
                              {m.role}
                            </span>
                          </Badge>
                        ))
                      )}
                    </div>
                  </TableCell>

                  {/* App Admin */}
                  <TableCell>
                    {user.is_app_admin ? (
                      <Badge className="gap-1 border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
                        <ShieldAlert className="size-3" />
                        App Admin
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">
                        User
                      </span>
                    )}
                  </TableCell>

                  {/* Joined */}
                  <TableCell
                    className="text-muted-foreground whitespace-nowrap text-xs"
                    title={new Date(user.created_at).toLocaleString()}
                  >
                    {formatDistanceToNow(new Date(user.created_at), {
                      addSuffix: true,
                    })}
                  </TableCell>

                  {/* Actions */}
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openEdit(user)}
                        title="Edit user"
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => openDelete(user)}
                        title="Delete user"
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create User Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create User</DialogTitle>
            <DialogDescription>
              Create a new user account. They will receive an email to set their
              password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                placeholder="user@example.com"
                value={createEmail}
                onChange={(e) => setCreateEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-name">Full Name (optional)</Label>
              <Input
                id="create-name"
                type="text"
                placeholder="Jane Doe"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
            </div>
            {organizations.length > 0 && (
              <div className="space-y-2">
                <Label>Add to Organization (optional)</Label>
                <Select value={createOrgId} onValueChange={setCreateOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {createOrgId && (
              <div className="space-y-2">
                <Label>Role in Organization</Label>
                <Select value={createRole} onValueChange={setCreateRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="create-admin">App Admin</Label>
                <p className="text-xs text-muted-foreground">
                  Grants access to the admin dashboard
                </p>
              </div>
              <Switch
                id="create-admin"
                checked={createIsAdmin}
                onCheckedChange={setCreateIsAdmin}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={createLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createLoading}>
              {createLoading && <Loader2 className="size-4 animate-spin" />}
              Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update {editUser?.email ?? "user"} details.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                type="text"
                placeholder="Jane Doe"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="edit-admin">App Admin</Label>
                <p className="text-xs text-muted-foreground">
                  Grants access to the admin dashboard
                </p>
              </div>
              <Switch
                id="edit-admin"
                checked={editIsAdmin}
                onCheckedChange={setEditIsAdmin}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditOpen(false)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={editLoading} className="bg-emerald-600 text-white hover:bg-emerald-700">
              {editLoading && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{deleteUser?.email}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm space-y-1">
            <p className="font-medium text-destructive">This will permanently delete:</p>
            <ul className="list-disc list-inside text-muted-foreground text-xs space-y-0.5">
              <li>Their user account and profile</li>
              <li>All organization memberships</li>
              {deleteUser && deleteUser.memberships.some((m) => m.role === "owner") && (
                <li className="text-destructive font-medium">
                  Organizations they own (and all org data: teams, connections, billing, requests)
                </li>
              )}
            </ul>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="size-4 animate-spin" />}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
