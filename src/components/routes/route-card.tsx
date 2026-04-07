"use client";

import { useState } from "react";
import { Check, ChevronDown, Filter } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PLATFORM_ICONS } from "@/components/messaging/platform-card";
import { SOURCE_CONFIG } from "@/components/approvals/source-icons";
import { cn } from "@/lib/utils";
import type { MessagingConnection, RoutingRules } from "@/lib/types/database";
import type { SourceInfo } from "@/components/messaging/connection-list";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS = [
  { value: "all", label: "All priorities" },
  { value: "low", label: "Low+" },
  { value: "medium", label: "Medium+" },
  { value: "high", label: "High+" },
  { value: "critical", label: "Critical only" },
] as const;

const PLATFORM_COLORS: Record<string, string> = {
  slack: "#4A154B",
  discord: "#5865F2",
  teams: "#6264A7",
  telegram: "#0088CC",
};

const PLATFORM_NAMES: Record<string, string> = {
  slack: "Slack",
  discord: "Discord",
  teams: "Microsoft Teams",
  telegram: "Telegram",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RouteCardProps {
  connection: MessagingConnection;
  sources: SourceInfo[];
  routedSources: string[];
  saving: boolean;
  onUpdate: (rules: RoutingRules) => void;
}

export function RouteCard({
  connection,
  sources,
  routedSources,
  saving,
  onUpdate,
}: RouteCardProps) {
  const rules = connection.routing_rules ?? {};
  const [filtersOpen, setFiltersOpen] = useState(false);

  // "all" means no source filter set = accept everything
  const isAllSources = !rules.sources || rules.sources.length === 0;

  const [localSources, setLocalSources] = useState<string[]>(
    rules.sources ?? [],
  );
  const [localPriorities, setLocalPriorities] = useState<string[]>(
    rules.priorities ?? [],
  );
  const [localActionTypes, setLocalActionTypes] = useState<string>(
    (rules.action_types ?? []).join(", "),
  );

  const PlatformIcon = PLATFORM_ICONS[connection.platform as keyof typeof PLATFORM_ICONS];
  const color = PLATFORM_COLORS[connection.platform] ?? "#6b7280";
  const platformName = PLATFORM_NAMES[connection.platform] ?? connection.platform;

  // ---- Source toggle ------------------------------------------------------

  function toggleSource(platform: string) {
    let next: string[];
    if (localSources.includes(platform)) {
      next = localSources.filter((s) => s !== platform);
    } else {
      next = [...localSources, platform];
    }
    setLocalSources(next);

    // Save immediately: if all sources are selected, clear the filter (= all)
    const allPlatforms = sources.map((s) => s.platform);
    const effectiveSources =
      next.length === 0 || next.length === allPlatforms.length ? [] : next;

    onUpdate({
      ...rules,
      sources: effectiveSources.length > 0 ? effectiveSources : undefined,
      priorities: localPriorities.length > 0 ? localPriorities : undefined,
      action_types: localActionTypes.trim()
        ? localActionTypes.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    });
  }

  function toggleAllSources() {
    if (localSources.length === 0) {
      // Currently "all". Switch to none.
      // Don't save yet, they need to pick sources
      return;
    }
    // Reset to "all"
    setLocalSources([]);
    onUpdate({
      ...rules,
      sources: undefined,
      priorities: localPriorities.length > 0 ? localPriorities : undefined,
      action_types: localActionTypes.trim()
        ? localActionTypes.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    });
  }

  // ---- Filter save --------------------------------------------------------

  function saveFilters() {
    onUpdate({
      sources: localSources.length > 0 ? localSources : undefined,
      priorities: localPriorities.length > 0 ? localPriorities : undefined,
      action_types: localActionTypes.trim()
        ? localActionTypes.split(",").map((s) => s.trim()).filter(Boolean)
        : undefined,
    });
  }

  // ---- Priority toggle ----------------------------------------------------

  function togglePriority(priority: string) {
    setLocalPriorities((prev) =>
      prev.includes(priority)
        ? prev.filter((p) => p !== priority)
        : [...prev, priority],
    );
  }

  // ---- Render -------------------------------------------------------------

  const hasFilters =
    (rules.priorities && rules.priorities.length > 0) ||
    (rules.action_types && rules.action_types.length > 0);

  return (
    <Card className="border-0 shadow-[var(--shadow-card)]">
      <CardContent className="space-y-4">
        {/* Header: channel info */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex size-10 shrink-0 items-center justify-center rounded-lg shadow-sm"
              style={{ backgroundColor: color }}
            >
              {PlatformIcon && <PlatformIcon className="size-5 text-white" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">
                  {connection.channel_name ?? connection.channel_id}
                </span>
                <Badge variant="secondary" className="text-xs">
                  {platformName}
                </Badge>
              </div>
              {connection.workspace_name && (
                <p className="text-xs text-muted-foreground">
                  {connection.workspace_name}
                </p>
              )}
            </div>
          </div>

          {/* Status summary */}
          <div className="flex items-center gap-2 shrink-0">
            {hasFilters && (
              <Badge variant="outline" className="gap-1 text-xs">
                <Filter className="size-3" />
                Filtered
              </Badge>
            )}
            <Badge variant={isAllSources && localSources.length === 0 ? "default" : "secondary"}>
              {isAllSources && localSources.length === 0
                ? "All sources"
                : `${routedSources.length} source${routedSources.length !== 1 ? "s" : ""}`}
            </Badge>
          </div>
        </div>

        {/* Source toggles */}
        {sources.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Notify from:
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* All sources chip */}
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
                {localSources.length === 0 && (
                  <Check className="size-3" />
                )}
                All sources
              </button>

              {/* Individual source chips */}
              {sources.map((source) => {
                const config = SOURCE_CONFIG[source.platform];
                const isSelected =
                  localSources.length === 0 ||
                  localSources.includes(source.platform);
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
            </div>
          </div>
        )}

        {/* Advanced filters */}
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
                <Input
                  value={localActionTypes}
                  onChange={(e) => setLocalActionTypes(e.target.value)}
                  placeholder="deploy*, db:migrate, send-email"
                  className="h-8 text-xs"
                />
                <p className="text-[11px] text-muted-foreground">
                  Comma-separated action types. Use * for wildcards.
                </p>
              </div>

              {/* Notification event toggles */}
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id={`notify-create-${connection.id}`}
                    checked={connection.notify_on_create}
                    disabled
                  />
                  <Label htmlFor={`notify-create-${connection.id}`} className="text-xs">
                    New requests
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id={`notify-decide-${connection.id}`}
                    checked={connection.notify_on_decide}
                    disabled
                  />
                  <Label htmlFor={`notify-decide-${connection.id}`} className="text-xs">
                    Decisions
                  </Label>
                </div>
              </div>

              {/* Save button */}
              <Button
                size="sm"
                onClick={saveFilters}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Filters"}
              </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
