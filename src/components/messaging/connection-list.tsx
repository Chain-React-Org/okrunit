"use client";

import { useState, useRef, useEffect, memo } from "react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Check,
  ChevronDown,
  Filter,
  Hash,
  Plus,
  Power,
  PowerOff,
  Trash2,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PLATFORM_ICONS } from "@/components/messaging/platform-card";
import { SOURCE_CONFIG } from "@/components/approvals/source-icons";
import { cn } from "@/lib/utils";
import type { MessagingConnection, RoutingRules } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "low", label: "Low and above" },
  { value: "medium", label: "Medium and above" },
  { value: "high", label: "High and above" },
  { value: "critical", label: "Critical only" },
] as const;

const PLATFORM_NAMES: Record<string, string> = {
  email: "Email",
  slack: "Slack",
  discord: "Discord",
  teams: "Microsoft Teams",
  telegram: "Telegram",
};

const PLATFORM_COLORS: Record<string, string> = {
  email: "#059669",
  slack: "#E01E5A",
  discord: "#5865F2",
  teams: "#5B5FC7",
  telegram: "#0088CC",
};

// ---------------------------------------------------------------------------
// Preset action types
// ---------------------------------------------------------------------------

const PRESET_ACTION_TYPES: { value: string; label: string; description: string }[] = [
  { value: "deploy.*", label: "Deployments", description: "deploy.production, deploy.staging, etc." },
  { value: "db:migrate", label: "Database migrations", description: "Database schema migrations" },
  { value: "user.delete", label: "User deletion", description: "Permanent user account deletion" },
  { value: "user.*", label: "All user actions", description: "user.delete, user.suspend, etc." },
  { value: "infra.*", label: "Infrastructure changes", description: "infra.scale, infra.destroy, etc." },
  { value: "billing.*", label: "Billing actions", description: "billing.charge, billing.refund, etc." },
  { value: "access.*", label: "Access control", description: "access.grant, access.revoke, etc." },
  { value: "data.export", label: "Data exports", description: "Bulk data export operations" },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceInfo {
  id: string;
  platform: string;
  name: string;
}

interface ConnectionListProps {
  connections: MessagingConnection[];
  sources: SourceInfo[];
  onDisconnect: (id: string) => Promise<void>;
  onPriorityChange: (id: string, priority: string) => Promise<void>;
  onToggleActive: (id: string, isActive: boolean) => Promise<void>;
  onUpdateRoute: (id: string, rules: RoutingRules) => Promise<void>;
  onToggleNotify: (id: string, field: "notify_on_create" | "notify_on_decide", value: boolean) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Inline routing config per connection
// ---------------------------------------------------------------------------

function RoutingConfig({
  connection,
  sources,
  saving,
  onUpdate,
  onToggleNotify,
}: {
  connection: MessagingConnection;
  sources: SourceInfo[];
  saving: boolean;
  onUpdate: (rules: RoutingRules) => void;
  onToggleNotify: (field: "notify_on_create" | "notify_on_decide", value: boolean) => void;
}) {
  const rules = connection.routing_rules ?? {};
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showAllSources, setShowAllSources] = useState(false);
  const [actionTypeDropdownOpen, setActionTypeDropdownOpen] = useState(false);
  const [customActionType, setCustomActionType] = useState("");
  const actionTypeRef = useRef<HTMLDivElement>(null);

  const COLLAPSED_SOURCE_COUNT = 6;

  const [localSources, setLocalSources] = useState<string[]>(
    rules.sources ?? [],
  );
  const [localPriorities, setLocalPriorities] = useState<string[]>(
    rules.priorities ?? [],
  );
  const [localActionTypes, setLocalActionTypes] = useState<string[]>(
    rules.action_types ?? [],
  );

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (actionTypeRef.current && !actionTypeRef.current.contains(e.target as Node)) {
        setActionTypeDropdownOpen(false);
      }
    }
    if (actionTypeDropdownOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [actionTypeDropdownOpen]);

  function buildRules(overrides: Partial<{ sources: string[]; priorities: string[]; actionTypes: string[] }>) {
    const s = overrides.sources ?? localSources;
    const p = overrides.priorities ?? localPriorities;
    const a = overrides.actionTypes ?? localActionTypes;

    const allPlatforms = sources.map((src) => src.platform);
    const effectiveSources =
      s.length === 0 || s.length === allPlatforms.length ? [] : s;

    return {
      sources: effectiveSources.length > 0 ? effectiveSources : undefined,
      priorities: p.length > 0 ? p : undefined,
      action_types: a.length > 0 ? a : undefined,
    };
  }

  function addActionType(value: string) {
    const trimmed = value.trim();
    if (!trimmed || localActionTypes.includes(trimmed)) return;
    const next = [...localActionTypes, trimmed];
    setLocalActionTypes(next);
  }

  function removeActionType(value: string) {
    const next = localActionTypes.filter((t) => t !== value);
    setLocalActionTypes(next);
  }

  function addCustomActionType() {
    if (customActionType.trim()) {
      addActionType(customActionType.trim());
      setCustomActionType("");
    }
  }

  function toggleSource(platform: string) {
    const next = localSources.includes(platform)
      ? localSources.filter((s) => s !== platform)
      : [...localSources, platform];
    setLocalSources(next);
    onUpdate(buildRules({ sources: next }));
  }

  function toggleAllSources() {
    if (localSources.length === 0) return;
    setLocalSources([]);
    onUpdate(buildRules({ sources: [] }));
  }

  function togglePriority(priority: string) {
    setLocalPriorities((prev) =>
      prev.includes(priority)
        ? prev.filter((p) => p !== priority)
        : [...prev, priority],
    );
  }

  function saveFilters() {
    onUpdate(buildRules({}));
  }

  const hasFilters =
    (rules.priorities && rules.priorities.length > 0) ||
    (rules.action_types && rules.action_types.length > 0);

  if (sources.length === 0) return null;

  return (
    <div className="space-y-3 border-t pt-3">
      {/* Source toggles */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">
          Notify from:
        </span>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={toggleAllSources}
            disabled={saving}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
              localSources.length === 0
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground",
            )}
          >
            {localSources.length === 0 && <Check className="size-3" />}
            All sources
          </button>

          {(showAllSources
            ? sources
            : sources.slice(0, COLLAPSED_SOURCE_COUNT)
          ).map((source) => {
            const config = SOURCE_CONFIG[source.platform];
            const isExplicit = localSources.includes(source.platform);

            return (
              <button
                key={source.platform}
                onClick={() => toggleSource(source.platform)}
                disabled={saving}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  isExplicit
                    ? "border-primary bg-primary/10 text-primary"
                    : localSources.length === 0
                      ? "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                      : "border-border text-muted-foreground/50 hover:border-primary/50 hover:text-foreground",
                )}
              >
                {config && (
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded",
                      config.bgColor,
                    )}
                  >
                    <config.icon className={cn("size-2.5", config.color)} />
                  </span>
                )}
                {config?.label ?? source.name}
                {isExplicit && <Check className="size-3" />}
              </button>
            );
          })}

          {sources.length > COLLAPSED_SOURCE_COUNT && (
            <button
              onClick={() => setShowAllSources(!showAllSources)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors cursor-pointer"
            >
              {showAllSources
                ? "Show less"
                : `+${sources.length - COLLAPSED_SOURCE_COUNT} more`}
            </button>
          )}
        </div>
      </div>

      {/* Advanced filters toggle */}
      <div>
        <button
          onClick={() => setFiltersOpen(!filtersOpen)}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Filter className="size-3" />
          Advanced filters
          <ChevronDown
            className={cn(
              "size-3 transition-transform",
              filtersOpen && "rotate-180",
            )}
          />
          {hasFilters && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              active
            </Badge>
          )}
        </button>

        {filtersOpen && (
          <div className="pt-3">
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              {/* Priority filter */}
              <div className="space-y-2">
                <Label className="text-xs">Priority filter</Label>
                <div className="flex flex-wrap gap-2">
                  {(["low", "medium", "high", "critical"] as const).map(
                    (priority) => {
                      const isSelected = localPriorities.includes(priority);
                      return (
                        <button
                          key={priority}
                          onClick={() => togglePriority(priority)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors capitalize cursor-pointer",
                            isSelected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/50",
                          )}
                        >
                          {isSelected && <Check className="size-3" />}
                          {priority}
                        </button>
                      );
                    },
                  )}
                  {localPriorities.length > 0 && (
                    <button
                      onClick={() => setLocalPriorities([])}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Only notify for selected priorities. Leave empty for all.
                </p>
              </div>

              {/* Action type filter */}
              <div className="space-y-2">
                <Label className="text-xs">Action types</Label>

                {/* Selected action type chips */}
                {localActionTypes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {localActionTypes.map((actionType) => (
                      <span
                        key={actionType}
                        className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                      >
                        {actionType}
                        <button
                          onClick={() => removeActionType(actionType)}
                          className="hover:text-destructive transition-colors cursor-pointer"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                    <button
                      onClick={() => setLocalActionTypes([])}
                      className="text-xs text-muted-foreground hover:text-foreground cursor-pointer px-1"
                    >
                      Clear all
                    </button>
                  </div>
                )}

                {/* Dropdown + custom input */}
                <div ref={actionTypeRef} className="relative">
                  <button
                    onClick={() => setActionTypeDropdownOpen(!actionTypeDropdownOpen)}
                    className="flex h-8 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-xs text-muted-foreground hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <span>{localActionTypes.length === 0 ? "Select action types to filter..." : "Add more..."}</span>
                    <ChevronDown className={cn("size-3 transition-transform", actionTypeDropdownOpen && "rotate-180")} />
                  </button>

                  {actionTypeDropdownOpen && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {/* Custom input */}
                      <div className="flex items-center gap-1 border-b p-2">
                        <Input
                          value={customActionType}
                          onChange={(e) => setCustomActionType(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addCustomActionType();
                            }
                          }}
                          placeholder="Type custom action type..."
                          className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 px-1"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={addCustomActionType}
                          disabled={!customActionType.trim()}
                          className="shrink-0"
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>

                      {/* Preset options */}
                      <div className="max-h-48 overflow-y-auto p-1">
                        {PRESET_ACTION_TYPES.filter(
                          (preset) => !localActionTypes.includes(preset.value),
                        ).map((preset) => (
                          <button
                            key={preset.value}
                            onClick={() => {
                              addActionType(preset.value);
                            }}
                            className="flex w-full items-start gap-2 rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent transition-colors cursor-pointer"
                          >
                            <div className="min-w-0">
                              <div className="font-medium">{preset.label}</div>
                              <div className="text-[11px] text-muted-foreground truncate">
                                {preset.description ?? preset.value}
                              </div>
                            </div>
                          </button>
                        ))}
                        {PRESET_ACTION_TYPES.filter(
                          (preset) => !localActionTypes.includes(preset.value),
                        ).length === 0 && (
                          <p className="px-2 py-1.5 text-xs text-muted-foreground">
                            All presets selected. Type a custom action type above.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[11px] text-muted-foreground">
                  Only notify for matching action types. Supports wildcards (e.g. deploy.*). Leave empty for all.
                </p>
              </div>

              {/* Notification event toggles */}
              <div className="space-y-2">
                <Label className="text-xs">Notification events</Label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`notify-create-${connection.id}`}
                          checked={connection.notify_on_create}
                          onCheckedChange={(checked) =>
                            onToggleNotify("notify_on_create", checked)
                          }
                        />
                        <Label
                          htmlFor={`notify-create-${connection.id}`}
                          className="text-xs cursor-pointer"
                        >
                          New requests
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Send a notification to this channel whenever a new approval request is created. The message includes the request title, priority, and interactive approve/reject buttons.
                    </TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`notify-decide-${connection.id}`}
                          checked={connection.notify_on_decide}
                          onCheckedChange={(checked) =>
                            onToggleNotify("notify_on_decide", checked)
                          }
                        />
                        <Label
                          htmlFor={`notify-decide-${connection.id}`}
                          className="text-xs cursor-pointer"
                        >
                          Decisions
                        </Label>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Send a notification to this channel when an approval request is approved or rejected. Includes who made the decision and any comment they left.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {/* Save button */}
              <Button size="sm" onClick={saveFilters} disabled={saving}>
                {saving ? "Saving..." : "Save Filters"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discord Channel Picker - lightweight inline dropdown
// ---------------------------------------------------------------------------

function DiscordChannelPicker({
  connectionId,
  channelName,
  channels,
  loading,
  onOpen,
  onRefresh,
  onSelect,
}: {
  connectionId: string;
  channelName: string | null;
  channels: Array<{ id: string; name: string }>;
  loading: boolean;
  onOpen: () => void;
  onRefresh: () => void;
  onSelect: (ch: { id: string; name: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => {
          if (!open) onOpen();
          setOpen(!open);
        }}
        className="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <Hash className="size-3 shrink-0" />
        <span className="truncate max-w-[120px]">{channelName ?? "Select channel"}</span>
        <ChevronDown className="size-3 shrink-0 opacity-50" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[180px] max-h-[240px] overflow-y-auto rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95 slide-in-from-top-2">
          {loading ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Loading channels...</div>
          ) : channels.length > 0 ? (
            <>
              {channels.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => { onSelect(ch); setOpen(false); }}
                  className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs hover:bg-accent cursor-pointer"
                >
                  <Hash className="size-3 text-muted-foreground shrink-0" />
                  {ch.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onRefresh()}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-muted-foreground italic hover:bg-accent cursor-pointer"
              >
                Refresh channels
              </button>
            </>
          ) : (
            <>
              <div className="px-2 py-1.5 text-xs text-muted-foreground">No channels found</div>
              <button
                type="button"
                onClick={() => onRefresh()}
                className="flex w-full items-center gap-1.5 rounded-sm px-2 py-1.5 text-xs text-muted-foreground italic hover:bg-accent cursor-pointer"
              >
                Refresh channels
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Connection List
// ---------------------------------------------------------------------------

export const ConnectionList = memo(function ConnectionList({
  connections,
  sources,
  onDisconnect,
  onPriorityChange,
  onToggleActive,
  onUpdateRoute,
  onToggleNotify,
}: ConnectionListProps) {
  const [disconnectTarget, setDisconnectTarget] =
    useState<MessagingConnection | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingRoute, setSavingRoute] = useState<string | null>(null);
  const [discordChannels, setDiscordChannels] = useState<Record<string, Array<{ id: string; name: string }>>>({});
  const [channelLoading, setChannelLoading] = useState<string | null>(null);
  const [channelOverrides, setChannelOverrides] = useState<Record<string, { id: string; name: string }>>({});

  async function fetchDiscordChannels(connectionId: string, forceRefresh = false) {
    if (discordChannels[connectionId] && !forceRefresh) return;
    setChannelLoading(connectionId);
    try {
      const res = await fetch(`/api/v1/messaging/discord/channels?connection_id=${connectionId}`);
      if (res.ok) {
        const data = await res.json();
        setDiscordChannels((prev) => ({ ...prev, [connectionId]: data.channels }));
      } else {
        toast.error("Failed to load Discord channels");
      }
    } catch {
      toast.error("Failed to load Discord channels");
    } finally {
      setChannelLoading(null);
    }
  }

  async function handleChannelChange(connectionId: string, channelId: string, channelName: string) {
    // Optimistic update
    setChannelOverrides((prev) => ({ ...prev, [connectionId]: { id: channelId, name: channelName } }));
    toast.success(`Channel changed to #${channelName}`);

    try {
      const res = await fetch(`/api/v1/messaging/connections`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: connectionId, channel_id: channelId, channel_name: channelName }),
      });
      if (!res.ok) {
        setChannelOverrides((prev) => { const next = { ...prev }; delete next[connectionId]; return next; });
        toast.error("Failed to change channel");
      }
    } catch {
      setChannelOverrides((prev) => { const next = { ...prev }; delete next[connectionId]; return next; });
      toast.error("Failed to change channel");
    }
  }

  async function handleDisconnect() {
    if (!disconnectTarget) return;
    setLoading(true);
    try {
      await onDisconnect(disconnectTarget.id);
      setDisconnectTarget(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(connection: MessagingConnection) {
    await onToggleActive(connection.id, connection.is_active);
  }

  async function handleRouteUpdate(id: string, rules: RoutingRules) {
    setSavingRoute(id);
    try {
      await onUpdateRoute(id, rules);
    } finally {
      setSavingRoute(null);
    }
  }

  return (
    <>
      <div className="space-y-3">
        {connections.map((connection) => {
          const Icon =
            PLATFORM_ICONS[
              connection.platform as keyof typeof PLATFORM_ICONS
            ];
          const platformName =
            PLATFORM_NAMES[connection.platform] ?? connection.platform;
          const color = PLATFORM_COLORS[connection.platform] ?? "#6b7280";

          return (
            <Card
              key={connection.id}
              className={cn(
                "messaging-connection-card border-0 shadow-[var(--shadow-card)]",
                !connection.is_active && "opacity-60",
              )}
            >
              <CardContent className="space-y-0">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: platform + channel info */}
                  <div className="flex items-center gap-3">
                    {connection.platform === "slack" || connection.platform === "teams" ? (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm border">
                        {Icon && <Icon className="size-6" />}
                      </div>
                    ) : (
                      <div
                        className="flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm"
                        style={{ backgroundColor: color }}
                      >
                        {Icon && <Icon className="size-5 text-white" />}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {connection.platform === "discord"
                            ? channelOverrides[connection.id]?.name
                              ? `# ${channelOverrides[connection.id].name}`
                              : connection.channel_id?.startsWith("pending:")
                                ? (connection.workspace_name ?? "Discord Server")
                                : `# ${connection.channel_name ?? connection.channel_id}`
                            : (connection.channel_name ?? connection.channel_id)}
                        </span>
                        <Badge
                          variant={
                            connection.is_active ? "default" : "secondary"
                          }
                        >
                          {connection.is_active ? "Active" : "Paused"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{platformName}</span>
                        {connection.workspace_name && (
                          <>
                            <span aria-hidden="true">&middot;</span>
                            <span>{connection.workspace_name}</span>
                          </>
                        )}
                        {connection.platform === "discord" && (
                          <>
                            <span aria-hidden="true">&middot;</span>
                            <DiscordChannelPicker
                              connectionId={connection.id}
                              channelName={
                                channelOverrides[connection.id]?.name
                                ?? (connection.channel_name && connection.channel_name !== connection.workspace_name
                                  ? connection.channel_name
                                  : null)
                              }
                              channels={discordChannels[connection.id] ?? []}
                              loading={channelLoading === connection.id}
                              onOpen={() => fetchDiscordChannels(connection.id)}
                              onRefresh={() => fetchDiscordChannels(connection.id, true)}
                              onSelect={(ch) => handleChannelChange(connection.id, ch.id, ch.name)}
                            />
                          </>
                        )}
                        <span aria-hidden="true">&middot;</span>
                        <span>
                          Added{" "}
                          {formatDistanceToNow(
                            new Date(connection.created_at),
                            { addSuffix: true },
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: priority filter + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Select
                      value={connection.priority_filter}
                      onValueChange={(value) =>
                        onPriorityChange(connection.id, value)
                      }
                    >
                      <SelectTrigger size="sm" className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="outline"
                      size="icon-sm"
                      title={
                        connection.is_active
                          ? "Pause notifications"
                          : "Resume notifications"
                      }
                      onClick={() => handleToggle(connection)}
                    >
                      {connection.is_active ? (
                        <PowerOff className="size-3.5" />
                      ) : (
                        <Power className="size-3.5" />
                      )}
                    </Button>

                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Disconnect"
                      onClick={() => setDisconnectTarget(connection)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Inline routing config */}
                <RoutingConfig
                  connection={connection}
                  sources={sources}
                  saving={savingRoute === connection.id}
                  onUpdate={(rules) => handleRouteUpdate(connection.id, rules)}
                  onToggleNotify={(field, value) => onToggleNotify(connection.id, field, value)}
                />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Disconnect confirmation dialog */}
      <Dialog
        open={!!disconnectTarget}
        onOpenChange={(open) => {
          if (!open) setDisconnectTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect Channel</DialogTitle>
            <DialogDescription>
              Are you sure you want to disconnect{" "}
              <span className="font-medium text-foreground">
                {disconnectTarget?.channel_name ??
                  disconnectTarget?.channel_id}
              </span>
              ? You will stop receiving approval notifications on this channel.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDisconnectTarget(null)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={loading}
              className="cursor-pointer"
            >
              {loading ? "Disconnecting..." : "Disconnect"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});
