"use client";

import { useState, useRef, useEffect } from "react";
import {
  CheckCircle2,
  Loader2,
  Mail,
  Monitor,
  Smartphone,
  Code2,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface EmailPreview {
  id: string;
  name: string;
  description: string;
  category: string;
  html: string;
}

const DESKTOP_FRAME_WIDTH = 700;
const MOBILE_FRAME_WIDTH = 390;

const CATEGORY_ORDER = [
  "Onboarding",
  "Approvals",
  "Billing",
  "Reports",
  "Account",
];

export function EmailPreviewClient() {
  const [previews, setPreviews] = useState<EmailPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/v1/admin/email-previews");
      if (res.ok) {
        const data = await res.json();
        setPreviews(data.previews);
        if (data.previews.length > 0) {
          setSelected(data.previews[0].id);
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  const activePreview = previews.find((p) => p.id === selected);
  const frameWidth =
    viewport === "desktop" ? DESKTOP_FRAME_WIDTH : MOBILE_FRAME_WIDTH;
  const previewHtml =
    typeof window === "undefined" || !activePreview
      ? activePreview?.html ?? ""
      : activePreview.html
          .replace(/https:\/\/(?:gkapprove|okrunit)\.com/g, window.location.origin)
          .replace(/http:\/\/localhost:\d+/g, window.location.origin);

  async function handleCopyHtml() {
    if (!activePreview) return;
    await navigator.clipboard.writeText(activePreview.html);
    setCopied(true);
    toast.success("HTML copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  }

  // Group previews by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: previews.filter((p) => p.category === cat),
  })).filter((g) => g.items.length > 0);

  if (loading) {
    return (
      <div className="flex min-h-[480px] items-center justify-center rounded-2xl border border-border/60 bg-white">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Loading email previews...
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-116px)] min-h-0 flex-col gap-5 overflow-hidden xl:flex-row">
      {/* Sidebar */}
      <aside className="flex h-full w-full shrink-0 flex-col overflow-hidden rounded-2xl border border-border/60 bg-white shadow-sm xl:w-[280px]">
        {/* Header */}
        <div className="border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Mail className="size-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Email Templates</h2>
              <p className="text-[11px] text-muted-foreground">{previews.length} templates</p>
            </div>
          </div>
        </div>

        {/* Template list */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {grouped.map((group) => (
            <div key={group.category} className="mb-3">
              <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {group.category}
              </p>
              {group.items.map((preview) => (
                <button
                  key={preview.id}
                  onClick={() => { setSelected(preview.id); setShowSource(false); }}
                  className={cn(
                    "w-full cursor-pointer rounded-xl px-3 py-2.5 text-left transition-all",
                    selected === preview.id
                      ? "bg-primary/[0.08] shadow-sm ring-1 ring-primary/20"
                      : "hover:bg-muted/50",
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2
                      className={cn(
                        "size-3.5 shrink-0 transition-all",
                        selected === preview.id
                          ? "text-primary opacity-100"
                          : "text-muted-foreground/30 opacity-100",
                      )}
                    />
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-[13px] font-medium",
                          selected === preview.id ? "text-primary" : "text-foreground",
                        )}
                      >
                        {preview.name}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </aside>

      {/* Preview pane */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden">
        {activePreview && (
          <>
            {/* Toolbar */}
            <div className="flex shrink-0 items-center justify-between rounded-2xl border border-border/60 bg-white px-5 py-3 shadow-sm">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {activePreview.name}
                </h3>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {activePreview.description}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={handleCopyHtml}
                  className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  title="Copy HTML"
                >
                  {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>

                <button
                  onClick={() => setShowSource(!showSource)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    showSource
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border/60 bg-background text-muted-foreground hover:text-foreground",
                  )}
                  title="View source"
                >
                  <Code2 className="size-3.5" />
                  Source
                </button>

                <div className="flex items-center rounded-lg border border-border/60 bg-background p-0.5">
                  <button
                    onClick={() => setViewport("desktop")}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      viewport === "desktop"
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Monitor className="size-3.5" />
                      Desktop
                    </span>
                  </button>
                  <button
                    onClick={() => setViewport("mobile")}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
                      viewport === "mobile"
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span className="flex items-center gap-1.5">
                      <Smartphone className="size-3.5" />
                      Mobile
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content area — scrollable, full-size rendering */}
            {showSource ? (
              <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-border/60 bg-[#1e1e2e] p-6 shadow-sm">
                <pre className="text-xs leading-6 text-[#cdd6f4]">
                  <code>{activePreview.html}</code>
                </pre>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 justify-center overflow-hidden rounded-2xl border border-border/60 bg-slate-100 p-6 shadow-sm">
                  <div
                    className="flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg"
                    style={{ width: frameWidth, maxWidth: "100%" }}
                  >
                    {/* Browser chrome */}
                    <div className="flex shrink-0 items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5">
                      <span className="size-2.5 rounded-full bg-red-300" />
                      <span className="size-2.5 rounded-full bg-amber-300" />
                      <span className="size-2.5 rounded-full bg-emerald-400" />
                      <div className="ml-3 flex-1 rounded-md bg-white px-3 py-1 text-center">
                        <span className="text-[11px] font-medium text-zinc-400">
                          {viewport === "desktop" ? "mail.google.com" : "mail.app"}
                        </span>
                      </div>
                    </div>
                    <iframe
                      ref={iframeRef}
                      srcDoc={previewHtml}
                      className="block min-h-0 flex-1 border-0 bg-white"
                      style={{ width: frameWidth }}
                      title={`Preview: ${activePreview.name}`}
                      sandbox="allow-same-origin"
                    />
                  </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
