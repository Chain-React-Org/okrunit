"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Mail, Hash, Headphones, Send } from "lucide-react";
import { toast } from "sonner";

import { PlatformCard } from "@/components/messaging/platform-card";
import { ConnectionList } from "@/components/messaging/connection-list";
import { EmailConnectDialog } from "@/components/messaging/email-connect-dialog";
import dynamic from "next/dynamic";

const TelegramDeepLinkDialog = dynamic(
  () => import("@/components/messaging/telegram-deep-link-dialog").then((m) => m.TelegramDeepLinkDialog),
);
import { EmptyState } from "@/components/ui/empty-state";
import { SOURCE_CONFIG, AVAILABLE_SOURCES } from "@/components/approvals/source-icons";
import type { ApprovalFlow, MessagingConnection, MessagingPlatform, RoutingRules } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Platform definitions
// ---------------------------------------------------------------------------

interface PlatformDef {
  platform: MessagingPlatform;
  name: string;
  description: string;
  color: string;
  installUrl: string | null; // null = uses dialog (Telegram)
  connectLabel: string;
}

const PLATFORMS: PlatformDef[] = [
  {
    platform: "email",
    name: "Email",
    description:
      "Send approval notifications to email addresses or distribution lists with approve/reject links.",
    color: "#059669",
    installUrl: null,
    connectLabel: "Connect Email",
  },
  {
    platform: "slack",
    name: "Slack",
    description:
      "Get approval notifications in Slack channels with interactive approve/reject buttons.",
    color: "#E01E5A",
    installUrl: "/api/v1/messaging/slack/install",
    connectLabel: "Connect Slack",
  },
  {
    platform: "discord",
    name: "Discord",
    description:
      "Receive approval notifications in Discord channels with button interactions.",
    color: "#5865F2",
    installUrl: "/api/v1/messaging/discord/install",
    connectLabel: "Connect Discord",
  },
  {
    platform: "teams",
    name: "Microsoft Teams",
    description:
      "Send approval notifications to Teams channels with adaptive card actions.",
    color: "#5B5FC7",
    installUrl: "/api/v1/messaging/teams/install",
    connectLabel: "Connect Teams",
  },
  {
    platform: "telegram",
    name: "Telegram",
    description:
      "Send approval notifications to Telegram chats with inline keyboard buttons.",
    color: "#0088CC",
    installUrl: null,
    connectLabel: "Connect Telegram",
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MessagingConnectionsPageProps {
  connections: MessagingConnection[];
  flows: Pick<ApprovalFlow, "id" | "source">[];
}

export function MessagingConnectionsPage({
  connections: initialConnections,
  flows,
}: MessagingConnectionsPageProps) {
  const router = useRouter();
  const [connections, setConnections] =
    useState<MessagingConnection[]>(initialConnections);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);

  // Only show sources that are actually available as integrations
  const sources = Object.entries(SOURCE_CONFIG)
    .filter(([platform]) => AVAILABLE_SOURCES.has(platform))
    .map(([platform, config]) => ({
      id: platform,
      platform,
      name: config.label,
    }));

  // Count connections per platform
  function countForPlatform(platform: MessagingPlatform): number {
    return connections.filter((c) => c.platform === platform).length;
  }

  // Handle connect button click
  function handleConnect(platform: MessagingPlatform, installUrl: string | null) {
    if (platform === "email") {
      setEmailDialogOpen(true);
    } else if (platform === "telegram") {
      setTelegramDialogOpen(true);
    } else if (installUrl) {
      window.location.href = installUrl;
    }
  }

  // Handle disconnect
  async function handleDisconnect(id: string) {
    try {
      const res = await fetch(`/api/v1/messaging/connections/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to disconnect");
      }
      setConnections((prev) => prev.filter((c) => c.id !== id));
      toast.success("Channel disconnected");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect");
    }
  }

  // Handle priority filter change
  async function handlePriorityChange(id: string, priority: string) {
    try {
      const res = await fetch(`/api/v1/messaging/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority_filter: priority }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update");
      }
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, priority_filter: priority } : c,
        ),
      );
      toast.success("Priority filter updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  // Handle routing rules update
  async function handleUpdateRoute(id: string, routingRules: RoutingRules) {
    try {
      const res = await fetch(`/api/v1/messaging/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routing_rules: routingRules }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update route");
      }
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, routing_rules: routingRules } : c,
        ),
      );
      toast.success("Notification route updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update route");
    }
  }

  // Handle toggle active
  async function handleToggleActive(id: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/v1/messaging/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update");
      }
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, is_active: !isActive } : c,
        ),
      );
      toast.success(isActive ? "Channel paused" : "Channel activated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  // Handle notification toggle
  async function handleToggleNotify(
    id: string,
    field: "notify_on_create" | "notify_on_decide",
    value: boolean,
  ) {
    try {
      const res = await fetch(`/api/v1/messaging/connections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Failed to update");
      }
      setConnections((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, [field]: value } : c,
        ),
      );
      toast.success("Notification setting updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    }
  }

  // Handle email connect success
  function handleEmailSuccess(connection: MessagingConnection) {
    setConnections((prev) => [connection, ...prev]);
    setEmailDialogOpen(false);
    router.refresh();
  }

  // Handle Telegram connect success
  function handleTelegramSuccess(connection: MessagingConnection) {
    setConnections((prev) => [connection, ...prev]);
    setTelegramDialogOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-8" data-tour="messaging-section">
      {/* Platform cards grid */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        {PLATFORMS.map((p) => (
          <PlatformCard
            key={p.platform}
            platform={p.platform}
            name={p.name}
            description={p.description}
            color={p.color}
            connectLabel={p.connectLabel}
            connectedCount={countForPlatform(p.platform)}
            onConnect={() => handleConnect(p.platform, p.installUrl)}
          />
        ))}
      </div>

      {/* Connected channels */}
      {connections.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Connected Channels
          </h2>
          <ConnectionList
            connections={connections}
            sources={sources}
            onDisconnect={handleDisconnect}
            onPriorityChange={handlePriorityChange}
            onToggleActive={handleToggleActive}
            onUpdateRoute={handleUpdateRoute}
            onToggleNotify={handleToggleNotify}
          />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-5 py-20">
          <div className="flex items-center gap-3">
            {[
              { icon: Mail, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-950/50" },
              { icon: Hash, color: "text-pink-600 dark:text-pink-400", bg: "bg-pink-100 dark:bg-pink-950/50" },
              { icon: MessageSquare, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-100 dark:bg-indigo-950/50" },
              { icon: Send, color: "text-sky-600 dark:text-sky-400", bg: "bg-sky-100 dark:bg-sky-950/50" },
            ].map(({ icon: Icon, color, bg }, i) => (
              <div key={i} className={`flex size-11 items-center justify-center rounded-xl ${bg}`}>
                <Icon className={`size-5 ${color}`} />
              </div>
            ))}
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <p className="text-base font-semibold text-foreground">No messaging channels connected</p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Connect a messaging platform above to start receiving approval notifications with interactive buttons.
            </p>
          </div>
        </div>
      )}

      {/* Email dialog */}
      <EmailConnectDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        onSuccess={handleEmailSuccess}
      />

      {/* Telegram dialog */}
      <TelegramDeepLinkDialog
        open={telegramDialogOpen}
        onOpenChange={setTelegramDialogOpen}
        onSuccess={handleTelegramSuccess}
      />
    </div>
  );
}
