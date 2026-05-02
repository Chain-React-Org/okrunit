"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import type { TweetConfig } from "@/lib/tweets/types";

interface MessagingConn {
  id: string;
  platform: string;
  channel_name: string | null;
  workspace_name: string | null;
  is_active: boolean;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MODEL_OPTIONS = [
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (free tier, fast)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6 (premium voice)" },
  { value: "anthropic/claude-haiku-4-5", label: "Claude Haiku 4.5" },
  { value: "openai/gpt-5", label: "GPT-5" },
];

export function TweetConfigForm() {
  const [config, setConfig] = useState<TweetConfig | null>(null);
  const [connections, setConnections] = useState<MessagingConn[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [slotInput, setSlotInput] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch("/api/v1/admin/tweets/config")
        .then((r) => r.json() as Promise<{ config: TweetConfig }>)
        .then((d) => {
          setConfig(d.config);
          setSlotInput(d.config.posting_slots.join(", "));
        }),
      fetch("/api/v1/admin/messaging-connections")
        .then((r) => (r.ok ? (r.json() as Promise<{ connections: MessagingConn[] }>) : { connections: [] }))
        .then((d) => setConnections(d.connections ?? []))
        .catch(() => setConnections([])),
    ]);
  }, []);

  if (!config) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  function update<K extends keyof TweetConfig>(key: K, value: TweetConfig[K]) {
    setConfig((c) => (c ? { ...c, [key]: value } : c));
    setSaved(false);
  }

  function toggleDay(day: number) {
    if (!config) return;
    const next = config.posting_days.includes(day)
      ? config.posting_days.filter((d) => d !== day)
      : [...config.posting_days, day].sort();
    update("posting_days", next);
  }

  function toggleConnection(id: string) {
    if (!config) return;
    const next = config.notify_connection_ids.includes(id)
      ? config.notify_connection_ids.filter((c) => c !== id)
      : [...config.notify_connection_ids, id];
    update("notify_connection_ids", next);
  }

  async function save() {
    if (!config) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const slots = slotInput
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const s of slots) {
        if (!/^\d{1,2}:\d{2}$/.test(s)) {
          setError(`Invalid slot format: "${s}". Use HH:mm in 24h UTC.`);
          setSaving(false);
          return;
        }
      }

      const body: Partial<TweetConfig> = {
        enabled: config.enabled,
        posting_slots: slots,
        posting_days: config.posting_days,
        generation_lead_minutes: config.generation_lead_minutes,
        model: config.model,
        fallback_model: config.fallback_model,
        theme_feature_pct: config.theme_feature_pct,
        theme_lesson_pct: config.theme_lesson_pct,
        theme_use_case_pct: config.theme_use_case_pct,
        theme_milestone_pct: config.theme_milestone_pct,
        notify_connection_ids: config.notify_connection_ids,
        auto_regenerate_on_reject: config.auto_regenerate_on_reject,
        auto_approve_feature: config.auto_approve_feature,
        auto_approve_lesson: config.auto_approve_lesson,
        auto_approve_use_case: config.auto_approve_use_case,
        auto_approve_milestone: config.auto_approve_milestone,
      };
      const resp = await fetch("/api/v1/admin/tweets/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await resp.json()) as { config?: TweetConfig; error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      if (data.config) {
        setConfig(data.config);
        setSlotInput(data.config.posting_slots.join(", "));
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  const themeSum =
    config.theme_feature_pct +
    config.theme_lesson_pct +
    config.theme_use_case_pct +
    config.theme_milestone_pct;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/tweets">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" /> Back to queue
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">Tweet Config</h1>
      </div>

      <Section title="Master switch">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm font-medium">Enable automation</Label>
            <p className="text-xs text-muted-foreground mt-1">
              When off, the cron skips generation and posting entirely.
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => update("enabled", v)}
          />
        </div>
      </Section>

      <Section title="Posting schedule">
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Slots (HH:mm in UTC, comma-separated)</Label>
            <Input
              value={slotInput}
              onChange={(e) => setSlotInput(e.target.value)}
              placeholder="14:00, 17:00"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Recommended: 14:00, 17:00 (10am and 1pm Eastern). Up to 4 slots.
            </p>
          </div>

          <div>
            <Label className="text-sm">Days</Label>
            <div className="flex gap-2 mt-1">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => toggleDay(i)}
                  className={`px-3 py-1.5 rounded-md text-xs border ${
                    config.posting_days.includes(i)
                      ? "bg-emerald-100 border-emerald-300 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "bg-background"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm">Generation lead time (minutes)</Label>
            <Input
              type="number"
              value={config.generation_lead_minutes}
              onChange={(e) =>
                update("generation_lead_minutes", Number(e.target.value))
              }
              min={5}
              max={240}
              className="mt-1 w-32"
            />
            <p className="text-xs text-muted-foreground mt-1">
              How early to generate the draft so you have time to review.
            </p>
          </div>
        </div>
      </Section>

      <Section title="AI model">
        <div className="space-y-3">
          <div>
            <Label className="text-sm">Primary model</Label>
            <select
              value={config.model}
              onChange={(e) => update("model", e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-sm">Fallback model</Label>
            <select
              value={config.fallback_model}
              onChange={(e) => update("fallback_model", e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm mt-1"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              Used if the primary fails.
            </p>
          </div>
        </div>
      </Section>

      <Section title="Theme mix (must sum to 100%)">
        <div className="grid grid-cols-2 gap-3">
          <PctField
            label="Feature drop"
            value={config.theme_feature_pct}
            onChange={(v) => update("theme_feature_pct", v)}
          />
          <PctField
            label="Lesson / hot take"
            value={config.theme_lesson_pct}
            onChange={(v) => update("theme_lesson_pct", v)}
          />
          <PctField
            label="Use case"
            value={config.theme_use_case_pct}
            onChange={(v) => update("theme_use_case_pct", v)}
          />
          <PctField
            label="Milestone"
            value={config.theme_milestone_pct}
            onChange={(v) => update("theme_milestone_pct", v)}
          />
        </div>
        <p
          className={`text-xs mt-2 ${themeSum === 100 ? "text-muted-foreground" : "text-red-500"}`}
        >
          Sum: {themeSum}% {themeSum !== 100 ? "(must be 100)" : ""}
        </p>
      </Section>

      <Section title="Auto-approve by theme">
        <p className="text-xs text-muted-foreground mb-2">
          When ON, drafts of that theme skip the approval queue and post
          automatically at their scheduled time. You will still get a
          messaging notification with a reject-before-time link, so you
          can still intercept anything weird. Off keeps the traditional
          review-and-approve flow.
        </p>
        <div className="space-y-2">
          {([
            ["auto_approve_feature", "Feature drops"],
            ["auto_approve_lesson", "Lessons / hot takes"],
            ["auto_approve_use_case", "Use cases"],
            ["auto_approve_milestone", "Milestones"],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between rounded-md p-2 hover:bg-muted/40">
              <Label className="text-sm">{label}</Label>
              <Switch
                checked={config[key]}
                onCheckedChange={(v) => update(key, v)}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Approval notifications">
        {connections.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No active messaging connections found. Connect Slack, Telegram, or Discord
            in your org settings first.
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Pick which messaging channels get pinged when a draft is ready.
              If none are selected, no approval notifications are sent. You
              can still review drafts here on the queue page.
            </p>
            {connections.map((c) => (
              <label
                key={c.id}
                className="flex items-center gap-2 text-sm rounded-md p-2 hover:bg-muted/40"
              >
                <Checkbox
                  checked={config.notify_connection_ids.includes(c.id)}
                  onCheckedChange={() => toggleConnection(c.id)}
                />
                <span className="font-medium capitalize">{c.platform}</span>
                <span className="text-muted-foreground">
                  {c.workspace_name ? `${c.workspace_name} · ` : ""}
                  {c.channel_name ?? c.id}
                </span>
              </label>
            ))}
          </div>
        )}
      </Section>

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="sticky bottom-0 border-t bg-background py-3 flex items-center gap-2">
        <Button onClick={save} disabled={saving || themeSum !== 100}>
          <Save className="size-4 mr-1.5" />
          {saving ? "Saving..." : "Save config"}
        </Button>
        {saved ? (
          <span className="text-xs text-emerald-600 flex items-center gap-1">
            <Check className="size-3" /> Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function PctField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={0}
          max={100}
          className="w-20"
        />
        <span className="text-xs text-muted-foreground">%</span>
      </div>
    </div>
  );
}
