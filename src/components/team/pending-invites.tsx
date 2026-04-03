"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Trash2, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

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
import { Card } from "@/components/ui/card";
import type { OrgInvite } from "@/lib/types/database";

// ---- Component ------------------------------------------------------------

interface PendingInvitesProps {
  invites: OrgInvite[];
  canManage: boolean;
}

export function PendingInvites({ invites, canManage }: PendingInvitesProps) {
  const router = useRouter();
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const visibleInvites = invites.filter((i) => !removedIds.has(i.id));

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
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Mail className="text-muted-foreground size-4" />
        <h2 className="text-sm font-medium">
          Pending Invitations ({visibleInvites.length})
        </h2>
      </div>

      <div className="divide-y">
        {visibleInvites.map((invite) => (
          <div
            key={invite.id}
            className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
          >
            <div className="flex-1 space-y-0.5 overflow-hidden">
              <p className="truncate text-sm font-medium">{invite.email}</p>
              <div className="text-muted-foreground flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-xs capitalize">
                  {invite.role}
                </Badge>
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  Expires{" "}
                  {formatDistanceToNow(new Date(invite.expires_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>

            {canManage && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    title="Revoke invite"
                  >
                    <Trash2 className="size-4 text-destructive" />
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
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
