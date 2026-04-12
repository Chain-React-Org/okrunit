"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Shield, Unlink, Globe, Code2, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OAuthGrant } from "@/lib/types/oauth-grant";

// ---- Fallback logos for known platforms ------------------------------------

function ZapierLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="currentColor">
      <path d="M63.207 26.418H44.432l13.193-13.193c-1.015-1.522-2.03-2.537-3.045-4.06a29.025 29.025 0 01-4.059-3.552L37.33 18.807V.54a17.252 17.252 0 00-5.074-.507A15.629 15.629 0 0027.18.54v18.775l-13.7-13.7A13.7 13.7 0 009.42 9.166c-1.015 1.522-2.537 2.537-3.552 4.06L19.06 26.418H.794l-.507 5.074a15.629 15.629 0 00.507 5.074H19.57l-13.7 13.7a27.198 27.198 0 007.611 7.611l13.193-13.193V63.46a17.252 17.252 0 005.074.507 15.629 15.629 0 005.074-.507V44.686L50.014 57.88a13.7 13.7 0 004.059-3.552 29.025 29.025 0 003.552-4.059L44.432 37.074h18.775A17.252 17.252 0 0063.715 32a19.028 19.028 0 00-.507-5.582zm-23.342 5.074a25.726 25.726 0 01-1.015 6.597 15.223 15.223 0 01-6.597 1.015 25.726 25.726 0 01-6.597-1.015 15.223 15.223 0 01-1.015-6.597 25.726 25.726 0 011.015-6.597 15.223 15.223 0 016.597-1.015 25.726 25.726 0 016.597 1.015 29.684 29.684 0 011.015 6.597z" />
    </svg>
  );
}

function MakeLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z" />
    </svg>
  );
}

function N8nLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 228 120" className={className} fill="currentColor">
      <path fillRule="evenodd" clipRule="evenodd" d="M204 48C192.817 48 183.42 40.3514 180.756 30H153.248C147.382 30 142.376 34.241 141.412 40.0272L140.425 45.9456C139.489 51.5648 136.646 56.4554 132.626 60C136.646 63.5446 139.489 68.4352 140.425 74.0544L141.412 79.9728C142.376 85.759 147.382 90 153.248 90H156.756C159.42 79.6486 168.817 72 180 72C193.255 72 204 82.7452 204 96C204 109.255 193.255 120 180 120C168.817 120 159.42 112.351 156.756 102H153.248C141.516 102 131.504 93.5181 129.575 81.9456L128.588 76.0272C127.624 70.241 122.618 66 116.752 66H107.244C104.58 76.3514 95.183 84 84 84C72.817 84 63.4204 76.3514 60.7561 66H47.2439C44.5796 76.3514 35.183 84 24 84C10.7452 84 0 73.2548 0 60C0 46.7452 10.7452 36 24 36C35.183 36 44.5796 43.6486 47.2439 54H60.7561C63.4204 43.6486 72.817 36 84 36C95.183 36 104.58 43.6486 107.244 54H116.752C122.618 54 127.624 49.759 128.588 43.9728L129.575 38.0544C131.504 26.4819 141.516 18 153.248 18L180.756 18C183.42 7.64864 192.817 0 204 0C217.255 0 228 10.7452 228 24C228 37.2548 217.255 48 204 48ZM204 36C210.627 36 216 30.6274 216 24C216 17.3726 210.627 12 204 12C197.373 12 192 17.3726 192 24C192 30.6274 197.373 36 204 36ZM24 72C30.6274 72 36 66.6274 36 60C36 53.3726 30.6274 48 24 48C17.3726 48 12 53.3726 12 60C12 66.6274 17.3726 72 24 72ZM96 60C96 66.6274 90.6274 72 84 72C77.3726 72 72 66.6274 72 60C72 53.3726 77.3726 48 84 48C90.6274 48 96 53.3726 96 60ZM192 96C192 102.627 186.627 108 180 108C173.373 108 168 102.627 168 96C168 89.3726 173.373 84 180 84C186.627 84 192 89.3726 192 96Z" />
    </svg>
  );
}

interface PlatformLogo {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
}

const PLATFORM_LOGOS: Record<string, PlatformLogo> = {
  zapier: { icon: ZapierLogo, color: "text-orange-600 dark:text-orange-400", bgColor: "bg-orange-100 dark:bg-orange-950/50" },
  make: { icon: MakeLogo, color: "text-violet-600 dark:text-violet-400", bgColor: "bg-violet-100 dark:bg-violet-950/50" },
  n8n: { icon: N8nLogo, color: "text-rose-600 dark:text-rose-400", bgColor: "bg-rose-100 dark:bg-rose-950/50" },
  windmill: { icon: Workflow, color: "text-sky-600 dark:text-sky-400", bgColor: "bg-sky-100 dark:bg-sky-950/50" },
  pipedream: { icon: Code2, color: "text-emerald-600 dark:text-emerald-400", bgColor: "bg-emerald-100 dark:bg-emerald-950/50" },
  github: { icon: Code2, color: "text-gray-800 dark:text-gray-300", bgColor: "bg-gray-100 dark:bg-gray-800/50" },
  temporal: { icon: Workflow, color: "text-indigo-600 dark:text-indigo-400", bgColor: "bg-indigo-100 dark:bg-indigo-950/50" },
  prefect: { icon: Workflow, color: "text-blue-600 dark:text-blue-400", bgColor: "bg-blue-100 dark:bg-blue-950/50" },
  dagster: { icon: Workflow, color: "text-purple-600 dark:text-purple-400", bgColor: "bg-purple-100 dark:bg-purple-950/50" },
};

function getPlatformLogo(clientName: string): PlatformLogo {
  const lower = clientName.toLowerCase();
  for (const [key, logo] of Object.entries(PLATFORM_LOGOS)) {
    if (lower.includes(key)) return logo;
  }
  return { icon: Globe, color: "text-muted-foreground", bgColor: "bg-muted" };
}

// ---- Component --------------------------------------------------------------

interface ConnectedAppCardProps {
  grant: OAuthGrant;
  onRevoke: (clientId: string) => Promise<void>;
}

export function ConnectedAppCard({ grant, onRevoke }: ConnectedAppCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleRevoke() {
    setLoading(true);
    try {
      await onRevoke(grant.client_id);
      setConfirmOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const platform = getPlatformLogo(grant.client_name);
  const PlatformIcon = platform.icon;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Logo */}
            <PlatformIcon className={cn("size-8 shrink-0", platform.color)} />
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2 text-base">
                {grant.client_name}
                <Badge variant="default">Connected</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Authorized via OAuth 2.0</p>
            </div>
          </div>

          {/* Revoke button - far right */}
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 text-destructive hover:bg-destructive/10"
            onClick={() => setConfirmOpen(true)}
          >
            <Unlink />
            Revoke
          </Button>
        </CardHeader>

        <CardContent>
          {/* Metadata row */}
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Shield className="size-3.5" />
              {grant.scopes.map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {s}
                </Badge>
              ))}
            </span>

            {grant.last_used_at && (
              <span>
                Last used{" "}
                {formatDistanceToNow(new Date(grant.last_used_at), {
                  addSuffix: true,
                })}
              </span>
            )}

            <span>
              Connected{" "}
              {formatDistanceToNow(new Date(grant.authorized_at), {
                addSuffix: true,
              })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Revoke confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Revoke Access for {grant.client_name}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3">
                <p>
                  This will <strong>immediately</strong> revoke all access tokens and refresh tokens
                  for {grant.client_name}. Any in-flight API calls will be rejected instantly.
                </p>
                <p>
                  All automations using this connection will stop working. To reconnect,
                  you will need to re-authorize {grant.client_name} from within the app itself.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRevoke}
              disabled={loading}
            >
              {loading ? "Revoking..." : "Revoke Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
