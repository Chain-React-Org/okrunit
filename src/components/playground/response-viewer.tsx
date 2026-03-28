"use client";

// ---------------------------------------------------------------------------
// OKrunit -- API Response Viewer
// Displays a formatted view of an HTTP response including status, timing,
// headers, and a syntax-highlighted JSON body.
// ---------------------------------------------------------------------------

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, ChevronRight } from "lucide-react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlaygroundResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusVariant(
  status: number,
): "default" | "secondary" | "destructive" | "outline" {
  if (status >= 200 && status < 300) return "default";
  if (status >= 400 && status < 500) return "secondary";
  if (status >= 500) return "destructive";
  return "outline";
}

function statusColor(status: number): string {
  if (status >= 200 && status < 300) return "bg-green-600 text-white";
  if (status >= 400 && status < 500) return "bg-yellow-600 text-white";
  if (status >= 500) return "bg-red-600 text-white";
  return "";
}

/**
 * Attempt to pretty-print a JSON string. Falls back to the raw string if
 * parsing fails (e.g. for non-JSON responses like plain text or HTML).
 */
function formatBody(raw: string): { formatted: string; isJson: boolean } {
  try {
    const parsed = JSON.parse(raw);
    return { formatted: JSON.stringify(parsed, null, 2), isJson: true };
  } catch {
    return { formatted: raw, isJson: false };
  }
}

/**
 * Extremely lightweight JSON syntax colouring via regex replacement.
 * Produces spans with Tailwind utility classes so we don't need an external
 * highlighting library.
 */
function highlightJson(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(?:\\.|[^"\\])*")\s*:/g,
      '<span class="text-sky-400">$1</span>:',
    )
    .replace(
      /:\s*("(?:\\.|[^"\\])*")/g,
      ': <span class="text-emerald-400">$1</span>',
    )
    .replace(
      /:\s*(\d+\.?\d*)/g,
      ': <span class="text-amber-400">$1</span>',
    )
    .replace(
      /:\s*(true|false)/g,
      ': <span class="text-violet-400">$1</span>',
    )
    .replace(
      /:\s*(null)/g,
      ': <span class="text-rose-400">$1</span>',
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ResponseViewer({
  response,
}: {
  response: PlaygroundResponse | null;
}) {
  const [headersOpen, setHeadersOpen] = useState(false);

  if (!response) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Response</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Send a request to see the response here.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { formatted, isJson } = formatBody(response.body);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Response</CardTitle>
          <div className="flex items-center gap-2">
            <Badge
              variant={statusVariant(response.status)}
              className={statusColor(response.status)}
            >
              {response.status} {response.statusText}
            </Badge>
            <span className="text-muted-foreground text-xs font-mono tabular-nums">
              {response.duration}ms
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ---- Response Headers (collapsible) ---- */}
        <div>
          <button
            type="button"
            onClick={() => setHeadersOpen((prev) => !prev)}
            className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs font-medium transition-colors"
          >
            {headersOpen ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Response Headers ({Object.keys(response.headers).length})
          </button>

          {headersOpen && (
            <div className="mt-2 rounded-md border bg-muted/40 p-3">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs font-mono">
                {Object.entries(response.headers).map(([key, value]) => (
                  <div key={key} className="contents">
                    <dt className="text-muted-foreground truncate">{key}</dt>
                    <dd className="truncate">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <Separator />

        {/* ---- Response Body ---- */}
        <div>
          <p className="text-muted-foreground mb-2 text-xs font-medium">
            Body
          </p>
          <pre className="max-h-[480px] overflow-auto rounded-md border bg-zinc-950 p-4 text-xs leading-relaxed font-mono text-zinc-100">
            {isJson ? (
              <code
                dangerouslySetInnerHTML={{
                  __html: highlightJson(formatted),
                }}
              />
            ) : (
              <code>{formatted}</code>
            )}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
