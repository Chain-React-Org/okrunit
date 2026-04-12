"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Calendar,
  Loader2,
  Unplug,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";

import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// ---- Types ------------------------------------------------------------------

interface CalendarConnection {
  id: string;
  provider: "google" | "microsoft";
  calendar_email: string;
  is_active: boolean;
  auto_delegate_to: string | null;
  created_at: string;
  updated_at: string;
}

interface OrgMember {
  id: string;
  name: string;
  email: string;
}

// ---- Helpers ----------------------------------------------------------------

const PROVIDER_LABELS: Record<string, string> = {
  google: "Google Calendar",
  microsoft: "Microsoft Calendar",
};

// ---- Component --------------------------------------------------------------

interface CalendarSettingsProps {
  orgId: string;
  userId: string;
}

export function CalendarSettings({ orgId, userId }: CalendarSettingsProps) {
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<CalendarConnection | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [delegateTo, setDelegateTo] = useState<string>("none");
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isConnecting, setIsConnecting] = useState<"google" | "microsoft" | null>(null);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);

  // ---- Fetch connection status and org members ------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, membersData] = await Promise.all([
        fetch("/api/v1/calendar/status"),
        (async () => {
          const supabase = createClient();
          const { data: memberships } = await supabase
            .from("org_memberships")
            .select("user_id, role")
            .eq("org_id", orgId);

          if (!memberships || memberships.length === 0) return [];

          const userIds = memberships.map((m) => m.user_id);
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, full_name, email")
            .in("id", userIds);

          return memberships
            .filter((m) => m.user_id !== userId)
            .map((m) => {
              const profile = profiles?.find((p) => p.id === m.user_id);
              return {
                id: m.user_id,
                name: profile?.full_name || profile?.email || m.user_id,
                email: profile?.email || "",
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name));
        })(),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        const conn = data.connections?.[0] ?? null;
        setConnection(conn);
        setDelegateTo(conn?.auto_delegate_to ?? "none");
      }

      setMembers(membersData);
    } catch (err) {
      console.error("Failed to load calendar settings:", err);
      toast.error("Failed to load calendar settings.");
    } finally {
      setLoading(false);
    }
  }, [orgId, userId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---- Connect calendar -----------------------------------------------------

  async function handleConnect(provider: "google" | "microsoft") {
    setIsConnecting(provider);
    try {
      const res = await fetch("/api/v1/calendar/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to start calendar connection");
      }

      const { redirect_url } = await res.json();
      window.location.href = redirect_url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to connect calendar.");
      setIsConnecting(null);
    }
  }

  // ---- Save delegation setting ----------------------------------------------

  async function handleSaveDelegation() {
    setIsSaving(true);
    try {
      const res = await fetch("/api/v1/calendar/status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auto_delegate_to: delegateTo === "none" ? null : delegateTo,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to update delegation setting");
      }

      const data = await res.json();
      const updated = data.connections?.[0] ?? null;
      if (updated) {
        setConnection(updated);
      }

      toast.success("Delegation setting saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save delegation setting.");
    } finally {
      setIsSaving(false);
    }
  }

  // ---- Disconnect calendar --------------------------------------------------

  async function handleDisconnect() {
    setIsDisconnecting(true);
    try {
      const res = await fetch("/api/v1/calendar/status", {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to disconnect calendar");
      }

      setConnection(null);
      setDelegateTo("none");
      setShowDisconnectDialog(false);
      toast.success("Calendar disconnected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect calendar.");
    } finally {
      setIsDisconnecting(false);
    }
  }

  // ---- Derived state --------------------------------------------------------

  const hasChanges = connection
    ? (delegateTo === "none" ? null : delegateTo) !== connection.auto_delegate_to
    : false;

  // ---- Loading state --------------------------------------------------------

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Calendar Connection
          </CardTitle>
          <CardDescription>
            Connect your calendar for automatic out-of-office delegation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-9 w-24" />
        </CardContent>
      </Card>
    );
  }

  // ---- Disconnected state ---------------------------------------------------

  if (!connection) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Calendar Connection
          </CardTitle>
          <CardDescription>
            Connect your calendar to automatically delegate approvals when
            you are out of office.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Calendar className="size-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">No calendar connected</p>
              <p className="text-xs text-muted-foreground max-w-sm">
                Connect your Google or Microsoft calendar to automatically
                delegate approvals when you have an out-of-office event.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                className="bg-white dark:bg-card"
                onClick={() => handleConnect("google")}
                disabled={isConnecting !== null}
              >
                {isConnecting === "google" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Connect Google Calendar
              </Button>
              <Button
                variant="outline"
                className="bg-white dark:bg-card"
                onClick={() => handleConnect("microsoft")}
                disabled={isConnecting !== null}
              >
                {isConnecting === "microsoft" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Connect Microsoft Calendar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ---- Connected state ------------------------------------------------------

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Calendar Connection
          </CardTitle>
          <CardDescription>
            Manage your connected calendar and out-of-office delegation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg border bg-muted/50">
                <Calendar className="size-5 text-foreground" />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">
                  {PROVIDER_LABELS[connection.provider] ?? connection.provider}
                </p>
                <p className="text-xs text-muted-foreground">
                  {connection.calendar_email}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-emerald-600">
                <CheckCircle2 className="size-4" />
                <span className="text-xs font-medium">Connected</span>
              </div>
            </div>
          </div>

          {/* Auto-delegate setting */}
          <div className="space-y-2">
            <Label htmlFor="delegate-select">Auto-Delegate To</Label>
            <Select value={delegateTo} onValueChange={setDelegateTo}>
              <SelectTrigger id="delegate-select" className="w-full">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  None (no auto-delegation)
                </SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                    {member.email && member.name !== member.email
                      ? ` (${member.email})`
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              When you have an out-of-office event on your calendar, your
              approvals will automatically be delegated to this person.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => setShowDisconnectDialog(true)}
            >
              <Unplug className="size-4" />
              Disconnect
            </Button>
            <Button
              onClick={handleSaveDelegation}
              disabled={isSaving || !hasChanges}
              size="sm"
            >
              {isSaving && <Loader2 className="size-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Disconnect confirmation dialog */}
      <AlertDialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect calendar?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove your calendar connection and disable automatic
              out-of-office delegation. You can reconnect at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={isDisconnecting}
            >
              {isDisconnecting && <Loader2 className="size-4 animate-spin" />}
              Disconnect
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
