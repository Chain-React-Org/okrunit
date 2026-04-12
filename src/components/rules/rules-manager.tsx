"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Pencil,
  GitBranch,
  GripVertical,
  CheckCircle,
  Route,
  Power,
  PowerOff,
  HelpCircle,
  X,
} from "lucide-react";
import { toast } from "sonner";

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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { ApprovalRule } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrgMember {
  id: string;
  full_name: string | null;
  email: string;
}

interface RulesManagerProps {
  initialRules: ApprovalRule[];
  teams: { id: string; name: string }[];
  connections: { id: string; name: string }[];
  members: OrgMember[];
  existingActionTypes: string[];
  existingSources: string[];
  existingTitles: string[];
}

interface RuleFormData {
  name: string;
  description: string;
  is_active: boolean;
  connection_id: string;
  action: "auto_approve" | "route";
  // Conditions
  priority_levels: string[];
  action_types: string[];
  sources: string[];
  risk_levels: string[];
  titles: string[];
  // Route action config
  route_target: "team" | "users" | "none";
  route_team_id: string;
  route_user_ids: string[];
  required_role: string;
  required_approvals: number;
  is_sequential: boolean;
}

const DEFAULT_FORM: RuleFormData = {
  name: "",
  description: "",
  is_active: true,
  connection_id: "",
  action: "route",
  priority_levels: [],
  action_types: [],
  sources: [],
  risk_levels: [],
  titles: [],
  route_target: "none",
  route_team_id: "",
  route_user_ids: [],
  required_role: "",
  required_approvals: 1,
  is_sequential: true,
};

const PRIORITIES = ["low", "medium", "high", "critical"] as const;
const RISK_LEVELS = ["low", "medium", "high", "critical"] as const;

const ALL_SOURCES = [
  "zapier", "make", "n8n", "monday", "github-actions",
  "temporal", "prefect", "dagster", "windmill", "pipedream", "api",
];

const COMMON_ACTION_TYPES = [
  "deploy", "delete", "update", "create", "restart",
  "scale", "rollback", "migrate", "approve", "publish",
  "release", "merge", "execute", "provision", "terminate",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function FieldTooltip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="size-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help shrink-0" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ruleToForm(rule: ApprovalRule): RuleFormData {
  const conditions = rule.conditions as Record<string, unknown>;
  const actionConfig = rule.action_config as Record<string, unknown>;

  return {
    name: rule.name,
    description: rule.description ?? "",
    is_active: rule.is_active,
    connection_id: rule.connection_id ?? "",
    action: rule.action as "auto_approve" | "route",
    priority_levels: (conditions.priority_levels as string[]) ?? [],
    action_types: (conditions.action_types as string[]) ?? [],
    sources: (conditions.sources as string[]) ?? [],
    risk_levels: (conditions.risk_levels as string[]) ?? [],
    titles: (conditions.titles as string[]) ?? ((conditions.title_pattern as string) ? [conditions.title_pattern as string] : []),
    route_target: actionConfig.team_id
      ? "team"
      : (actionConfig.user_ids as string[])?.length
        ? "users"
        : "none",
    route_team_id: (actionConfig.team_id as string) ?? "",
    route_user_ids: (actionConfig.user_ids as string[]) ?? [],
    required_role: (actionConfig.required_role as string) ?? "",
    required_approvals: (actionConfig.required_approvals as number) ?? 1,
    is_sequential: (actionConfig.is_sequential as boolean) ?? false,
  };
}

function formToPayload(form: RuleFormData) {
  const conditions: Record<string, unknown> = {};
  if (form.priority_levels.length > 0) conditions.priority_levels = form.priority_levels;
  if (form.action_types.length > 0) conditions.action_types = form.action_types;
  if (form.sources.length > 0) conditions.sources = form.sources;
  if (form.risk_levels.length > 0) conditions.risk_levels = form.risk_levels;
  if (form.titles.length > 0) conditions.titles = form.titles;

  const action_config: Record<string, unknown> = {};
  if (form.action === "route") {
    if (form.route_target === "team" && form.route_team_id) {
      action_config.team_id = form.route_team_id;
    } else if (form.route_target === "users" && form.route_user_ids.length > 0) {
      action_config.user_ids = form.route_user_ids;
      // For specific users, required approvals = number of selected users
      action_config.required_approvals = form.route_user_ids.length;
    }
    if (form.required_role) action_config.required_role = form.required_role;
    if (form.route_target !== "users" && form.required_approvals > 1) action_config.required_approvals = form.required_approvals;
    if (form.is_sequential) action_config.is_sequential = true;
  }

  return {
    name: form.name,
    description: form.description || undefined,
    is_active: form.is_active,
    connection_id: form.connection_id || undefined,
    conditions,
    action: form.action,
    action_config,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RulesManager({ initialRules, teams, connections, members, existingActionTypes, existingSources, existingTitles }: RulesManagerProps) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ApprovalRule | null>(null);
  const [form, setForm] = useState<RuleFormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");
  const [actionTypeSearch, setActionTypeSearch] = useState("");
  const [sourceSearch, setSourceSearch] = useState("");
  const [titleSearch, setTitleSearch] = useState("");

  function resetSearches() {
    setUserSearch("");
    setActionTypeSearch("");
    setSourceSearch("");
    setTitleSearch("");
  }

  function openCreate() {
    setEditingRule(null);
    setForm(DEFAULT_FORM);
    resetSearches();
    setDialogOpen(true);
  }

  function openEdit(rule: ApprovalRule) {
    setEditingRule(rule);
    setForm(ruleToForm(rule));
    resetSearches();
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Rule name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      const url = editingRule
        ? `/api/v1/rules/${editingRule.id}`
        : "/api/v1/rules";
      const method = editingRule ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to save rule");
      }

      toast.success(editingRule ? "Rule updated" : "Rule created");
      setDialogOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(ruleId: string) {
    setDeleting(ruleId);
    try {
      const res = await fetch(`/api/v1/rules/${ruleId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast.success("Rule deleted");
      router.refresh();
    } catch {
      toast.error("Failed to delete rule");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggle(rule: ApprovalRule) {
    try {
      const res = await fetch(`/api/v1/rules/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !rule.is_active }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch {
      toast.error("Failed to toggle rule");
    }
  }

  function togglePriority(level: string) {
    setForm((prev) => ({
      ...prev,
      priority_levels: prev.priority_levels.includes(level)
        ? prev.priority_levels.filter((l) => l !== level)
        : [...prev.priority_levels, level],
    }));
  }

  function toggleRisk(level: string) {
    setForm((prev) => ({
      ...prev,
      risk_levels: prev.risk_levels.includes(level)
        ? prev.risk_levels.filter((l) => l !== level)
        : [...prev.risk_levels, level],
    }));
  }

  function toggleUser(userId: string) {
    setForm((prev) => ({
      ...prev,
      route_user_ids: prev.route_user_ids.includes(userId)
        ? prev.route_user_ids.filter((id) => id !== userId)
        : [...prev.route_user_ids, userId],
    }));
  }

  const memberMap = new Map(members.map((m) => [m.id, m]));

  const filteredMembers = useMemo(() => {
    if (!userSearch.trim()) return members;
    const q = userSearch.toLowerCase();
    return members.filter(
      (m) => (m.full_name?.toLowerCase().includes(q)) || m.email.toLowerCase().includes(q),
    );
  }, [members, userSearch]);

  // Merge org-specific values with built-in lists, deduped
  const allActionTypes = useMemo(() => {
    const set = new Set([...existingActionTypes, ...COMMON_ACTION_TYPES]);
    return [...set].sort();
  }, [existingActionTypes]);

  const allSources = useMemo(() => {
    const set = new Set([...existingSources, ...ALL_SOURCES]);
    return [...set].sort();
  }, [existingSources]);

  const filteredActionTypes = useMemo(() => {
    if (!actionTypeSearch.trim()) return allActionTypes;
    const q = actionTypeSearch.toLowerCase();
    return allActionTypes.filter((v) => v.toLowerCase().includes(q));
  }, [allActionTypes, actionTypeSearch]);

  const filteredSources = useMemo(() => {
    if (!sourceSearch.trim()) return allSources;
    const q = sourceSearch.toLowerCase();
    return allSources.filter((v) => v.toLowerCase().includes(q));
  }, [allSources, sourceSearch]);

  const filteredTitles = useMemo(() => {
    if (!titleSearch.trim()) return existingTitles;
    const q = titleSearch.toLowerCase();
    return existingTitles.filter((v) => v.toLowerCase().includes(q));
  }, [existingTitles, titleSearch]);

  function toggleArrayItem(field: "action_types" | "sources" | "titles", value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  }

  function describeConditions(rule: ApprovalRule): string {
    const c = rule.conditions as Record<string, unknown>;
    const parts: string[] = [];
    if (c.priority_levels) parts.push(`priority in [${(c.priority_levels as string[]).join(", ")}]`);
    if (c.action_types) parts.push(`action in [${(c.action_types as string[]).join(", ")}]`);
    if (c.sources) parts.push(`source in [${(c.sources as string[]).join(", ")}]`);
    if (c.risk_levels) parts.push(`risk in [${(c.risk_levels as string[]).join(", ")}]`);
    if (c.titles) parts.push(`title in [${(c.titles as string[]).slice(0, 2).join(", ")}${(c.titles as string[]).length > 2 ? ` +${(c.titles as string[]).length - 2}` : ""}]`);
    if (c.title_pattern) parts.push(`title matches /${c.title_pattern}/`);
    return parts.length > 0 ? parts.join(" AND ") : "All requests";
  }

  function describeAction(rule: ApprovalRule): string {
    if (rule.action === "auto_approve") return "Auto-approve";
    const config = rule.action_config as Record<string, unknown>;
    const parts: string[] = ["Route"];
    if (config.team_id) {
      const team = teams.find((t) => t.id === config.team_id);
      parts.push(`to ${team?.name ?? "team"}`);
    }
    if ((config.user_ids as string[])?.length) {
      const names = (config.user_ids as string[])
        .map((id) => memberMap.get(id))
        .filter(Boolean)
        .map((m) => m!.full_name || m!.email.split("@")[0])
        .slice(0, 2);
      const remaining = (config.user_ids as string[]).length - names.length;
      const label = names.join(", ") + (remaining > 0 ? ` +${remaining}` : "");
      parts.push(`to ${label}`);
    }
    if (config.required_approvals && (config.required_approvals as number) > 1) {
      parts.push(`(require ${config.required_approvals})`);
    }
    if (config.is_sequential) parts.push("(sequential)");
    return parts.join(" ");
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-primary mb-0.5">Configuration</p>
            <h1 className="text-xl font-semibold tracking-tight">Approval Rules</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conditional routing rules evaluated in order. First match wins.
            </p>
          </div>
          <Button data-tour="create-rule-btn" size="sm" onClick={openCreate} className="gap-1.5 h-8">
            <Plus className="size-3.5" />
            New Rule
          </Button>
        </div>

        {/* Rules list */}
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/50 py-16 text-center">
            <GitBranch className="size-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No rules configured</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Rules let you auto-approve or route requests based on conditions like priority, source, or risk level.
            </p>
            <Button size="sm" className="mt-4 gap-1.5" onClick={openCreate}>
              <Plus className="size-3.5" />
              Create Rule
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, idx) => (
              <div
                key={rule.id}
                className={cn(
                  "group flex items-start gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3 transition-colors hover:border-border",
                  !rule.is_active && "opacity-50",
                )}
              >
                {/* Order indicator */}
                <div className="flex items-center gap-1 shrink-0 pt-0.5">
                  <GripVertical className="size-4 text-muted-foreground/30" />
                  <span className="text-xs font-mono text-muted-foreground w-4 text-center">
                    {idx + 1}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{rule.name}</h3>
                    <Badge
                      variant={rule.action === "auto_approve" ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {rule.action === "auto_approve" ? (
                        <><CheckCircle className="size-2.5 mr-1" />Auto-approve</>
                      ) : (
                        <><Route className="size-2.5 mr-1" />Route</>
                      )}
                    </Badge>
                    {!rule.is_active && (
                      <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-medium">If:</span> {describeConditions(rule)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium">Then:</span> {describeAction(rule)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleToggle(rule)}
                    title={rule.is_active ? "Disable" : "Enable"}
                  >
                    {rule.is_active ? (
                      <PowerOff className="size-3.5 text-muted-foreground" />
                    ) : (
                      <Power className="size-3.5 text-emerald-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => openEdit(rule)}
                  >
                    <Pencil className="size-3.5 text-muted-foreground" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => handleDelete(rule.id)}
                    disabled={deleting === rule.id}
                  >
                    <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) setDialogOpen(false); }}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-tour="rule-dialog">
            <DialogHeader>
              <DialogTitle>{editingRule ? "Edit Rule" : "Create Rule"}</DialogTitle>
              <DialogDescription>
                Define conditions and an action. All conditions must match (AND logic).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="rule-name">Rule Name</Label>
                  <FieldTooltip text="A short, descriptive name to identify this rule. Your team will see this in the rules list." />
                </div>
                <Input
                  id="rule-name"
                  placeholder="e.g. Critical deploys need 2 approvers"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label>Description</Label>
                  <FieldTooltip text="Optional notes explaining when and why this rule should trigger. Helps teammates understand the rule's purpose." />
                </div>
                <Textarea
                  placeholder="Optional description..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                />
              </div>

              {/* Connection scope */}
              {connections.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label>Scope to Connection</Label>
                    <FieldTooltip text="Limit this rule to requests from a specific connection (API key). Leave as 'All connections' to apply to every source." />
                  </div>
                  <Select value={form.connection_id || "all"} onValueChange={(v) => setForm((p) => ({ ...p, connection_id: v === "all" ? "" : v }))}>
                    <SelectTrigger className="bg-white dark:bg-card">
                      <SelectValue placeholder="All connections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All connections</SelectItem>
                      {connections.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Conditions section */}
              <div className="space-y-3 rounded-lg border p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" data-tour="rule-conditions">Conditions (all must match)</p>

                {/* Priority */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Priority Levels</Label>
                    <FieldTooltip text="Match requests with these priority levels. Leave empty to match any priority. Select multiple to match any of the selected levels." />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePriority(p)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium border transition-colors capitalize",
                          form.priority_levels.includes(p)
                            ? "bg-primary text-white border-primary"
                            : "bg-white dark:bg-card text-muted-foreground border-border hover:border-primary/50",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Risk Levels */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Risk Levels</Label>
                    <FieldTooltip text="Match requests tagged with these risk levels. Risk levels are set by the workflow that creates the request." />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {RISK_LEVELS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleRisk(r)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-medium border transition-colors capitalize",
                          form.risk_levels.includes(r)
                            ? "bg-primary text-white border-primary"
                            : "bg-white dark:bg-card text-muted-foreground border-border hover:border-primary/50",
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action types */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Action Types</Label>
                    <FieldTooltip text="Match requests with these action types. These are populated from action types already seen in your organization's requests." />
                  </div>
                  {form.action_types.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {form.action_types.map((v) => (
                        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {v}
                          <button type="button" onClick={() => toggleArrayItem("action_types", v)} className="hover:text-destructive"><X className="size-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="rounded-md border">
                    <div className="border-b px-2 py-1.5">
                      <Input placeholder="Search action types..." value={actionTypeSearch} onChange={(e) => setActionTypeSearch(e.target.value)} className="h-7 border-0 shadow-none text-xs focus-visible:ring-0 px-1" />
                    </div>
                    <div className="max-h-[100px] overflow-y-auto p-1">
                      {filteredActionTypes.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No matches</p>
                      ) : filteredActionTypes.map((v) => {
                        const selected = form.action_types.includes(v);
                        return (
                          <button key={v} type="button" onClick={() => toggleArrayItem("action_types", v)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors", selected ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground")}>
                            <div className={cn("flex size-3.5 shrink-0 items-center justify-center rounded border", selected ? "border-primary bg-primary text-white" : "border-input")}>{selected && <CheckCircle className="size-2.5" />}</div>
                            <span className="truncate">{v}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Sources */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Sources</Label>
                    <FieldTooltip text="Match requests from specific platforms. These are populated from sources already seen in your organization's requests." />
                  </div>
                  {form.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {form.sources.map((v) => (
                        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                          {v}
                          <button type="button" onClick={() => toggleArrayItem("sources", v)} className="hover:text-destructive"><X className="size-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="rounded-md border">
                    <div className="border-b px-2 py-1.5">
                      <Input placeholder="Search sources..." value={sourceSearch} onChange={(e) => setSourceSearch(e.target.value)} className="h-7 border-0 shadow-none text-xs focus-visible:ring-0 px-1" />
                    </div>
                    <div className="max-h-[100px] overflow-y-auto p-1">
                      {filteredSources.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No matches</p>
                      ) : filteredSources.map((v) => {
                        const selected = form.sources.includes(v);
                        return (
                          <button key={v} type="button" onClick={() => toggleArrayItem("sources", v)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors", selected ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground")}>
                            <div className={cn("flex size-3.5 shrink-0 items-center justify-center rounded border", selected ? "border-primary bg-primary text-white" : "border-input")}>{selected && <CheckCircle className="size-2.5" />}</div>
                            <span className="truncate">{v}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Titles */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">Title</Label>
                    <FieldTooltip text="Match requests with these specific titles. These are populated from titles already seen in your organization's requests." />
                  </div>
                  {form.titles.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {form.titles.map((v) => (
                        <span key={v} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary max-w-[200px]">
                          <span className="truncate">{v}</span>
                          <button type="button" onClick={() => toggleArrayItem("titles", v)} className="hover:text-destructive shrink-0"><X className="size-2.5" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="rounded-md border">
                    <div className="border-b px-2 py-1.5">
                      <Input
                        placeholder="Search or type a custom title..."
                        value={titleSearch}
                        onChange={(e) => setTitleSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && titleSearch.trim() && !form.titles.includes(titleSearch.trim())) {
                            e.preventDefault();
                            toggleArrayItem("titles", titleSearch.trim());
                            setTitleSearch("");
                          }
                        }}
                        className="h-7 border-0 shadow-none text-xs focus-visible:ring-0 px-1"
                      />
                    </div>
                    <div className="max-h-[100px] overflow-y-auto p-1">
                      {/* Show "Add custom" option when search doesn't match existing */}
                      {titleSearch.trim() && !existingTitles.includes(titleSearch.trim()) && !form.titles.includes(titleSearch.trim()) && (
                        <button
                          type="button"
                          onClick={() => { toggleArrayItem("titles", titleSearch.trim()); setTitleSearch(""); }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted text-primary font-medium"
                        >
                          <Plus className="size-3.5 shrink-0" />
                          Add &ldquo;{titleSearch.trim()}&rdquo;
                        </button>
                      )}
                      {filteredTitles.length === 0 && !titleSearch.trim() ? (
                        <p className="text-xs text-muted-foreground text-center py-2">No existing titles. Type one above and press Enter to add.</p>
                      ) : filteredTitles.map((v) => {
                        const selected = form.titles.includes(v);
                        return (
                          <button key={v} type="button" onClick={() => toggleArrayItem("titles", v)} className={cn("flex w-full items-center gap-2 rounded px-2 py-1 text-xs transition-colors", selected ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground")}>
                            <div className={cn("flex size-3.5 shrink-0 items-center justify-center rounded border", selected ? "border-primary bg-primary text-white" : "border-input")}>{selected && <CheckCircle className="size-2.5" />}</div>
                            <span className="truncate">{v}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action section */}
              <div className="space-y-3 rounded-lg border p-3" data-tour="rule-action-section">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Action</p>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label className="text-xs">When conditions match</Label>
                    <FieldTooltip text="Choose what happens when a request matches all conditions. Auto-approve skips human review. Route sends the request to specific people or teams for approval." />
                  </div>
                  <Select value={form.action} onValueChange={(v) => setForm((p) => ({ ...p, action: v as "auto_approve" | "route" }))}>
                    <SelectTrigger className="bg-white dark:bg-card">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto_approve">Auto-approve</SelectItem>
                      <SelectItem value="route">Route to specific approvers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {form.action === "route" && (
                  <div className="space-y-3 mt-2">
                    {/* Route target */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs">Route To</Label>
                        <FieldTooltip text="Choose who should review matching requests. 'Default approvers' uses the org-wide setting. 'Specific team' assigns a whole team. 'Specific users' lets you pick individual reviewers." />
                      </div>
                      <Select value={form.route_target} onValueChange={(v) => setForm((p) => ({ ...p, route_target: v as "team" | "users" | "none" }))}>
                        <SelectTrigger className="bg-white dark:bg-card">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Default approvers</SelectItem>
                          <SelectItem value="team">Specific team</SelectItem>
                          <SelectItem value="users">Specific users</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {form.route_target === "team" && teams.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs">Team</Label>
                          <FieldTooltip text="Select the team that should review matching requests. Any member of the team with approval permissions can approve." />
                        </div>
                        <Select value={form.route_team_id} onValueChange={(v) => setForm((p) => ({ ...p, route_team_id: v }))}>
                          <SelectTrigger className="bg-white dark:bg-card">
                            <SelectValue placeholder="Select team" />
                          </SelectTrigger>
                          <SelectContent>
                            {teams.map((t) => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {form.route_target === "users" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs">Users</Label>
                          <FieldTooltip text="Select the specific people who should review matching requests. All selected users must approve (sequential by default)." />
                        </div>
                        {/* Selected user pills */}
                        {form.route_user_ids.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {form.route_user_ids.map((uid) => {
                              const m = memberMap.get(uid);
                              return (
                                <span
                                  key={uid}
                                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
                                >
                                  {m ? (m.full_name || m.email.split("@")[0]) : uid.slice(0, 8)}
                                  <button
                                    type="button"
                                    onClick={() => toggleUser(uid)}
                                    className="hover:text-destructive"
                                  >
                                    <X className="size-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}
                        {/* Searchable checkbox list */}
                        <div className="rounded-md border">
                          <div className="border-b px-2 py-1.5">
                            <Input
                              placeholder="Search members..."
                              value={userSearch}
                              onChange={(e) => setUserSearch(e.target.value)}
                              className="h-7 border-0 shadow-none text-xs focus-visible:ring-0 px-1"
                            />
                          </div>
                          <div className="max-h-[140px] overflow-y-auto p-1">
                            {filteredMembers.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-3">
                                {members.length === 0 ? "No members in this organization" : "No members match your search"}
                              </p>
                            ) : (
                              filteredMembers.map((m) => {
                                const selected = form.route_user_ids.includes(m.id);
                                return (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => toggleUser(m.id)}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs transition-colors",
                                      selected
                                        ? "bg-primary/10 text-primary"
                                        : "hover:bg-muted text-foreground",
                                    )}
                                  >
                                    <div className={cn(
                                      "flex size-4 shrink-0 items-center justify-center rounded border",
                                      selected ? "border-primary bg-primary text-white" : "border-input",
                                    )}>
                                      {selected && <CheckCircle className="size-3" />}
                                    </div>
                                    <span className="truncate">
                                      {m.full_name || m.email.split("@")[0]}
                                    </span>
                                    {m.full_name && (
                                      <span className="text-muted-foreground truncate ml-auto text-[10px]">
                                        {m.email}
                                      </span>
                                    )}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Required approvals - hidden for specific users since user count = required count */}
                    {form.route_target !== "users" && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <Label className="text-xs">Required Approvals</Label>
                          <FieldTooltip text="How many people must approve before the request is granted. Set to 1 for single approval, or higher for multi-party approval." />
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          value={form.required_approvals}
                          onChange={(e) => setForm((p) => ({ ...p, required_approvals: parseInt(e.target.value) || 1 }))}
                          className="w-20 text-xs"
                        />
                      </div>
                    )}

                    {/* Sequential */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-xs">Sequential approval chain</Label>
                        <FieldTooltip text="When enabled, approvers must approve in order. The second approver is only notified after the first approves. Useful for hierarchical sign-off." />
                      </div>
                      <Switch
                        checked={form.is_sequential}
                        onCheckedChange={(v) => setForm((p) => ({ ...p, is_sequential: v }))}
                      />
                    </div>
                  </div>
                )}
              </div>

            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="bg-green-600 text-white hover:bg-green-700">
                {saving ? "Saving..." : editingRule ? "Save Changes" : "Create Rule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
