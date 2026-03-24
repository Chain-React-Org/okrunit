"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Mail, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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

function parseEmails(input: string): string[] {
  return input
    .split(/[,;\n]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0 && e.includes("@"));
}

export function InviteForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [bulkEmails, setBulkEmails] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [loading, setLoading] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);

  async function sendInvite(targetEmail: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch("/api/v1/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: targetEmail, role }),
    });

    if (!res.ok) {
      const data = await res.json();
      return { ok: false, error: data.error ?? "Failed to send invite" };
    }
    return { ok: true };
  }

  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Please enter an email address");
      return;
    }

    setLoading(true);
    try {
      const result = await sendInvite(trimmedEmail);
      if (!result.ok) throw new Error(result.error);

      toast.success(`Invitation sent to ${trimmedEmail}`);
      setEmail("");
      setRole("member");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setLoading(false);
    }
  }

  async function handleBulkSubmit(e: React.FormEvent) {
    e.preventDefault();

    const emails = parseEmails(bulkEmails);
    if (emails.length === 0) {
      toast.error("Please enter at least one valid email address");
      return;
    }

    // Deduplicate
    const unique = [...new Set(emails)];

    setLoading(true);
    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const addr of unique) {
      const result = await sendInvite(addr);
      if (result.ok) {
        sent++;
      } else {
        failed++;
        errors.push(`${addr}: ${result.error}`);
      }
    }

    if (sent > 0) {
      toast.success(`${sent} invitation${sent > 1 ? "s" : ""} sent`);
      setBulkEmails("");
      router.refresh();
    }
    if (failed > 0) {
      toast.error(`${failed} failed: ${errors.slice(0, 3).join("; ")}${errors.length > 3 ? "..." : ""}`);
    }

    setLoading(false);
  }

  const parsedCount = bulkMode ? parseEmails(bulkEmails).length : 0;

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserPlus className="text-muted-foreground size-4" />
          <h2 className="text-sm font-medium">Invite Team Member{bulkMode ? "s" : ""}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setBulkMode(!bulkMode)}
          className="gap-1.5 text-xs"
        >
          <Users className="size-3.5" />
          {bulkMode ? "Single invite" : "Bulk invite"}
        </Button>
      </div>

      {bulkMode ? (
        <form onSubmit={handleBulkSubmit}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-emails">Email addresses</Label>
              <Textarea
                id="bulk-emails"
                placeholder={"alice@company.com\nbob@company.com\ncharlie@company.com"}
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                disabled={loading}
                rows={4}
                className="font-mono text-sm"
              />
              <p className="text-muted-foreground text-xs">
                Separate emails with commas, semicolons, or new lines.
                {parsedCount > 0 && (
                  <span className="text-foreground font-medium"> {parsedCount} email{parsedCount !== 1 ? "s" : ""} detected.</span>
                )}
              </p>
            </div>
            <div className="flex items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-role">Role for all</Label>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as "admin" | "member")}
                  disabled={loading}
                >
                  <SelectTrigger id="bulk-role" className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={loading || parsedCount === 0}>
                {loading ? "Sending..." : `Send ${parsedCount} Invite${parsedCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <form onSubmit={handleSingleSubmit}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <div className="relative">
                <Mail className="text-muted-foreground absolute left-2.5 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as "admin" | "member")}
                disabled={loading}
              >
                <SelectTrigger id="invite-role" className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button type="submit" disabled={loading}>
              {loading ? "Sending..." : "Send Invite"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
