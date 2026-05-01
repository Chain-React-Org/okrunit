"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save, Check, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { TweetBrief } from "@/lib/tweets/types";

const FIELD_HELP: Record<keyof Omit<TweetBrief, "id" | "updated_at">, { label: string; help: string; rows: number; placeholder: string }> = {
  app_description: {
    label: "App description",
    help: "What OKrunit is, in one to three sentences. Used as the foundational context.",
    rows: 4,
    placeholder: "OKrunit is a human-in-the-loop approval gateway for automated workflows...",
  },
  voice_guidelines: {
    label: "Voice guidelines",
    help: "Tone, style rules, and what NOT to do. Be specific.",
    rows: 6,
    placeholder: "Direct, dev-style, no marketing fluff. No emojis. No hashtags. No em dashes.\nFirst person OK. Punchy fragments OK. Honest about tradeoffs.\nDon't say: seamless, powerful, robust, leverage, revolutionary.",
  },
  shipped_features: {
    label: "Shipped features",
    help: "Bullet list of features the AI can pick from. Concrete, user-visible behavior.",
    rows: 12,
    placeholder: "- Approval buttons in Slack, Telegram, Discord, Teams that gate AI agents\n- Sequential and parallel approval flows with dynamic routing\n- SLA warnings and auto-escalation\n- Zapier, Make, n8n integrations\n- ...",
  },
  hot_takes: {
    label: "Hot takes / lessons",
    help: "Opinions, lessons learned, contrarian observations. Spicy is fine.",
    rows: 8,
    placeholder: "- AI agents should never refund customers, send emails, or merge code without a human signing off\n- 'AI replaces humans' is the pitch; 'AI needs human sign-off for anything that costs money' is the reality\n- ...",
  },
  use_cases: {
    label: "Use cases",
    help: "Real-world scenarios. Name the integration, the action, what could go wrong.",
    rows: 8,
    placeholder: "- Zapier flow auto-replies to support tickets with GPT. OKrunit pings you in Slack to approve the draft before send.\n- n8n workflow runs DB cleanup. OKrunit holds the destructive step until a human approves.\n- ...",
  },
  example_tweets: {
    label: "Example tweets (style anchors)",
    help: "Real tweets in the voice you want. The AI will pattern-match against these.",
    rows: 10,
    placeholder: "Your AI agent shouldn't refund customers, send emails, or merge code without a human signing off. OKrunit drops a wait-for-approval step into Zapier, Make, or n8n.\n\n---\n\nShipped this week: ...",
  },
  do_not_mention: {
    label: "Do not mention",
    help: "Topics, claims, or words to avoid (e.g. unreleased features, internal tooling).",
    rows: 4,
    placeholder: "- Anything under /admin (internal tooling, not a customer feature)\n- Specific customer names\n- Pricing specifics until /pricing is live",
  },
};

export function TweetBriefForm() {
  const [brief, setBrief] = useState<TweetBrief | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/v1/admin/tweets/brief")
      .then((r) => r.json() as Promise<{ brief: TweetBrief }>)
      .then((d) => setBrief(d.brief));
  }, []);

  if (!brief) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  function update<K extends keyof TweetBrief>(key: K, value: TweetBrief[K]) {
    setBrief((b) => (b ? { ...b, [key]: value } : b));
    setSaved(false);
  }

  async function save() {
    if (!brief) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const body = {
        app_description: brief.app_description,
        voice_guidelines: brief.voice_guidelines,
        shipped_features: brief.shipped_features,
        hot_takes: brief.hot_takes,
        use_cases: brief.use_cases,
        do_not_mention: brief.do_not_mention,
        example_tweets: brief.example_tweets,
      };
      const resp = await fetch("/api/v1/admin/tweets/brief", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await resp.json()) as { brief?: TweetBrief; error?: string };
      if (!resp.ok) {
        setError(data.error ?? "Save failed");
        return;
      }
      if (data.brief) setBrief(data.brief);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin/tweets">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="size-4 mr-1" /> Back to queue
          </Button>
        </Link>
        <h1 className="text-xl font-semibold">Tweet Brief</h1>
      </div>

      <p className="text-sm text-muted-foreground">
        This is the context the AI uses to write tweets. Take 30 minutes to fill
        it out well. Quality of the brief is the single biggest driver of tweet
        quality. Update it as you ship new things.
      </p>

      {(Object.keys(FIELD_HELP) as Array<keyof typeof FIELD_HELP>).map((key) => {
        const cfg = FIELD_HELP[key];
        return (
          <div key={key} className="space-y-2">
            <Label className="text-sm font-medium">{cfg.label}</Label>
            <p className="text-xs text-muted-foreground">{cfg.help}</p>
            <Textarea
              value={brief[key]}
              onChange={(e) => update(key, e.target.value)}
              rows={cfg.rows}
              placeholder={cfg.placeholder}
              className="font-mono text-xs"
            />
          </div>
        );
      })}

      {error ? (
        <div className="rounded-md border border-red-500/40 bg-red-50 dark:bg-red-950/30 p-3 text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="sticky bottom-0 border-t bg-background py-3 flex items-center gap-2">
        <Button onClick={save} disabled={saving}>
          <Save className="size-4 mr-1.5" />
          {saving ? "Saving..." : "Save brief"}
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
