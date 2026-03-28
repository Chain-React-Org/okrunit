"use client";

// ---------------------------------------------------------------------------
// OKRunit -- API Request Builder
// Interactive form for constructing and sending HTTP requests against the
// OKRunit API. Includes pre-built request templates, connection-based
// auth pre-fill, and live code snippet generation.
// ---------------------------------------------------------------------------

import { useCallback, useState, useRef, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Check, Copy, HelpCircle, KeyRound, Loader2, Play, Plus, Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Connection } from "@/lib/types/database";
import {
  ResponseViewer,
  type PlaygroundResponse,
} from "@/components/playground/response-viewer";
import { CodeSnippets } from "@/components/playground/code-snippets";

// ---------------------------------------------------------------------------
// Types & Constants
// ---------------------------------------------------------------------------

type HttpMethod = "POST" | "GET" | "PATCH" | "DELETE";

interface Header {
  id: string;
  key: string;
  value: string;
}

interface Template {
  label: string;
  method: HttpMethod;
  endpoint: string;
  body: string;
}

interface EndpointOption {
  path: string;
  methods: HttpMethod[];
  description: string;
}

const METHODS: HttpMethod[] = ["POST", "GET", "PATCH", "DELETE"];

const API_ENDPOINTS: EndpointOption[] = [
  { path: "/api/v1/approvals", methods: ["GET", "POST"], description: "List or create approval requests" },
  { path: "/api/v1/approvals/{id}", methods: ["GET", "PATCH", "DELETE"], description: "Get, update, or delete an approval" },
  { path: "/api/v1/approvals/{id}/comments", methods: ["GET", "POST"], description: "List or add comments" },
  { path: "/api/v1/approvals/{id}/steps", methods: ["GET", "POST"], description: "List or create approval steps" },
  { path: "/api/v1/approvals/{id}/steps/{stepId}", methods: ["PATCH"], description: "Update an approval step" },
  { path: "/api/v1/approvals/{id}/conditions", methods: ["GET", "POST"], description: "List or create conditions" },
  { path: "/api/v1/approvals/{id}/conditions/check", methods: ["POST"], description: "Check conditions status" },
  { path: "/api/v1/approvals/{id}/attachments", methods: ["GET", "POST"], description: "List or upload attachments" },
  { path: "/api/v1/approvals/{id}/webhooks", methods: ["GET"], description: "List webhooks for an approval" },
  { path: "/api/v1/approvals/batch", methods: ["POST"], description: "Batch approve or reject" },
  { path: "/api/v1/approvals/batch/archive", methods: ["POST"], description: "Batch archive approvals" },
  { path: "/api/v1/connections", methods: ["GET", "POST"], description: "List or create connections" },
  { path: "/api/v1/connections/{id}", methods: ["GET", "PATCH", "DELETE"], description: "Get, update, or delete a connection" },
  { path: "/api/v1/connections/{id}/rotate", methods: ["POST"], description: "Rotate connection API key" },
  { path: "/api/v1/flows", methods: ["GET", "POST"], description: "List or create approval flows" },
  { path: "/api/v1/flows/{id}", methods: ["GET", "PATCH", "DELETE"], description: "Get, update, or delete a flow" },
  { path: "/api/v1/rules", methods: ["GET", "POST"], description: "List or create rules" },
  { path: "/api/v1/rules/{id}", methods: ["GET", "PATCH", "DELETE"], description: "Get, update, or delete a rule" },
  { path: "/api/v1/webhooks", methods: ["GET", "POST"], description: "List or create webhooks" },
  { path: "/api/v1/webhooks/{id}/replay", methods: ["POST"], description: "Replay a webhook delivery" },
  { path: "/api/v1/analytics", methods: ["GET"], description: "Get analytics overview" },
  { path: "/api/v1/analytics/sla", methods: ["GET"], description: "Get SLA metrics" },
  { path: "/api/v1/analytics/bottlenecks", methods: ["GET"], description: "Get bottleneck analysis" },
  { path: "/api/v1/analytics/cost-of-delay", methods: ["GET"], description: "Get cost of delay metrics" },
  { path: "/api/v1/teams", methods: ["GET", "POST"], description: "List or create teams" },
  { path: "/api/v1/teams/{id}", methods: ["GET", "PATCH", "DELETE"], description: "Get, update, or delete a team" },
  { path: "/api/v1/teams/{id}/members", methods: ["GET", "POST"], description: "List or add team members" },
  { path: "/api/v1/org", methods: ["PATCH"], description: "Update organization settings" },
  { path: "/api/v1/org/action-types", methods: ["GET"], description: "List action types" },
  { path: "/api/v1/export", methods: ["GET"], description: "Export data" },
  { path: "/api/v1/emergency-stop", methods: ["POST"], description: "Toggle emergency stop" },
  { path: "/api/v1/messaging/connections", methods: ["GET", "POST"], description: "List or create messaging connections" },
  { path: "/api/v1/messaging/connections/{id}", methods: ["GET", "PATCH", "DELETE"], description: "Manage a messaging connection" },
  { path: "/api/v1/delegations", methods: ["GET", "POST"], description: "List or create delegations" },
  { path: "/api/v1/delegations/{id}", methods: ["DELETE"], description: "Delete a delegation" },
  { path: "/api/v1/bulk-rules", methods: ["GET", "POST"], description: "List or create bulk rules" },
  { path: "/api/v1/bulk-rules/{id}", methods: ["GET", "PATCH", "DELETE"], description: "Manage a bulk rule" },
  { path: "/api/v1/saved-filters", methods: ["GET", "POST"], description: "List or create saved filters" },
];

const COMMON_HEADERS = [
  "Content-Type",
  "Authorization",
  "Accept",
  "X-Request-ID",
  "X-Idempotency-Key",
  "X-Webhook-Secret",
] as const;

const TEMPLATES: Template[] = [
  {
    label: "Create Approval",
    method: "POST",
    endpoint: "/api/v1/approvals",
    body: JSON.stringify(
      {
        title: "Deploy v2.4.0 to production",
        description: "Routine release with bug-fixes and minor UI tweaks.",
        action_type: "deployment",
        priority: "medium",
        metadata: {
          environment: "production",
          version: "2.4.0",
        },
      },
      null,
      2,
    ),
  },
  {
    label: "List Approvals",
    method: "GET",
    endpoint: "/api/v1/approvals",
    body: "",
  },
  {
    label: "Approve Request",
    method: "PATCH",
    endpoint: "/api/v1/approvals/{id}",
    body: JSON.stringify(
      {
        status: "approved",
        decision_comment: "Looks good, ship it!",
      },
      null,
      2,
    ),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let headerId = 0;
function nextHeaderId(): string {
  return `h_${++headerId}`;
}

function defaultHeaders(): Header[] {
  return [
    { id: nextHeaderId(), key: "Content-Type", value: "application/json" },
    { id: nextHeaderId(), key: "Authorization", value: "Bearer" },
  ];
}

// ---------------------------------------------------------------------------
// Header name dropdown with search
// ---------------------------------------------------------------------------

function HeaderNameSelect({
  value,
  onChange,
  usedHeaders,
}: {
  value: string;
  onChange: (v: string) => void;
  usedHeaders: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filtered = useMemo(() => {
    const usedLower = usedHeaders
      .filter((h) => h.toLowerCase() !== value.toLowerCase())
      .map((h) => h.toLowerCase());
    const available = COMMON_HEADERS.filter(
      (h) => !usedLower.includes(h.toLowerCase()),
    );
    if (!search) return available;
    const q = search.toLowerCase();
    return available.filter((h) => h.toLowerCase().includes(q));
  }, [search, usedHeaders, value]);

  return (
    <div className="relative flex-1" ref={containerRef}>
      <Input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setSearch(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Header name"
        className="font-mono text-xs"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-white shadow-lg">
          <div className="max-h-40 overflow-y-auto p-1">
            {filtered.map((header) => (
              <button
                key={header}
                type="button"
                onClick={() => {
                  onChange(header);
                  setSearch("");
                  setOpen(false);
                }}
                className={`flex w-full items-center rounded-md px-2 py-1.5 text-xs font-mono hover:bg-slate-50 ${
                  value === header ? "bg-primary/10 text-primary" : "text-slate-900"
                }`}
              >
                {header}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field label with tooltip
// ---------------------------------------------------------------------------

function FieldLabel({ label, tooltip, htmlFor }: { label: string; tooltip: string; htmlFor?: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="size-3.5 text-muted-foreground cursor-help" />
        </TooltipTrigger>
        <TooltipContent side="top">{tooltip}</TooltipContent>
      </Tooltip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RequestBuilder({
  connections: initialConnections,
}: {
  connections: Omit<Connection, "api_key_hash">[];
}) {
  // ---- State ---------------------------------------------------------------
  const [template, setTemplate] = useState("Create Approval");
  const [method, setMethod] = useState<HttpMethod>("POST");
  const [endpoint, setEndpoint] = useState("/api/v1/approvals");
  const [headers, setHeaders] = useState<Header[]>(defaultHeaders);
  const [body, setBody] = useState(TEMPLATES[0].body);
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState<PlaygroundResponse | null>(null);

  // Connection state
  const [connections, setConnections] = useState(initialConnections);
  const [showCreateConnection, setShowCreateConnection] = useState(false);
  const [newConnectionName, setNewConnectionName] = useState("");
  const [creatingConnection, setCreatingConnection] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [keyCopied, setKeyCopied] = useState(false);

  // ---- Header management ---------------------------------------------------

  const addHeader = useCallback(() => {
    setHeaders((prev) => [...prev, { id: nextHeaderId(), key: "", value: "" }]);
  }, []);

  const removeHeader = useCallback((id: string) => {
    setHeaders((prev) => prev.filter((h) => h.id !== id));
  }, []);

  const updateHeader = useCallback(
    (id: string, field: "key" | "value", value: string) => {
      setHeaders((prev) =>
        prev.map((h) => (h.id === id ? { ...h, [field]: value } : h)),
      );
    },
    [],
  );

  // ---- Connection selector -------------------------------------------------

  const selectConnection = useCallback(
    (connectionId: string) => {
      const conn = connections.find((c) => c.id === connectionId);
      if (!conn) return;

      // Update the Authorization header value with the prefix hint.
      setHeaders((prev) =>
        prev.map((h) =>
          h.key.toLowerCase() === "authorization"
            ? {
                ...h,
                value: `Bearer ${conn.api_key_prefix}... (paste full key)`,
              }
            : h,
        ),
      );

      toast.info(
        `Selected connection "${conn.name}". Paste the full API key into the Authorization header.`,
      );
    },
    [connections],
  );

  // ---- Create connection ----------------------------------------------------

  async function handleCreateConnection() {
    if (!newConnectionName.trim()) return;
    setCreatingConnection(true);
    try {
      const res = await fetch("/api/v1/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newConnectionName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create connection");
      }

      const { data: connection, api_key } = await res.json();
      setNewApiKey(api_key);
      setConnections((prev) => [connection, ...prev]);

      // Auto-fill the Authorization header with the new key
      setHeaders((prev) =>
        prev.map((h) =>
          h.key.toLowerCase() === "authorization"
            ? { ...h, value: `Bearer ${api_key}` }
            : h,
        ),
      );

      toast.success(`Connection "${connection.name}" created. API key has been filled into the Authorization header.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create connection");
    } finally {
      setCreatingConnection(false);
    }
  }

  async function copyApiKey() {
    if (!newApiKey) return;
    try {
      await navigator.clipboard.writeText(newApiKey);
      setKeyCopied(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }

  // ---- Template application ------------------------------------------------

  const applyTemplate = useCallback((templateLabel: string) => {
    const template = TEMPLATES.find((t) => t.label === templateLabel);
    if (!template) return;

    setMethod(template.method);
    setEndpoint(template.endpoint);
    setBody(template.body);

    // Reset headers to defaults when applying a template.
    setHeaders(defaultHeaders());
    setResponse(null);

    toast.success(`Template "${template.label}" applied`);
  }, []);

  // ---- Endpoint selection --------------------------------------------------

  const handleEndpointSelect = useCallback((path: string) => {
    setEndpoint(path);
    // Auto-set method to the first supported method for this endpoint
    const ep = API_ENDPOINTS.find((e) => e.path === path);
    if (ep && ep.methods.length > 0) {
      setMethod(ep.methods[0]);
    }
  }, []);

  // ---- Send request --------------------------------------------------------

  const sendRequest = useCallback(async () => {
    setSending(true);
    setResponse(null);

    try {
      const reqHeaders: Record<string, string> = {};
      for (const h of headers) {
        if (h.key.trim() && h.value.trim()) {
          reqHeaders[h.key.trim()] = h.value.trim();
        }
      }

      const hasBody =
        (method === "POST" || method === "PATCH") && body.trim();

      const start = Date.now();

      const res = await fetch(endpoint, {
        method,
        headers: reqHeaders,
        body: hasBody ? body : undefined,
      });

      const duration = Date.now() - start;

      // Read response body as text first, then try to parse.
      const resBody = await res.text();

      // Collect response headers into a plain object.
      const resHeaders: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        resHeaders[key] = value;
      });

      setResponse({
        status: res.status,
        statusText: res.statusText,
        headers: resHeaders,
        body: resBody,
        duration,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred";
      toast.error(`Request failed: ${message}`);
      setResponse({
        status: 0,
        statusText: "Network Error",
        headers: {},
        body: JSON.stringify({ error: message }, null, 2),
        duration: 0,
      });
    } finally {
      setSending(false);
    }
  }, [method, endpoint, headers, body]);

  // ---- Build full URL for code snippets ------------------------------------
  const fullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${endpoint}`
      : endpoint;

  const snippetHeaders = headers
    .filter((h) => h.key.trim() && h.value.trim())
    .map((h) => ({ key: h.key, value: h.value }));

  // Filter methods based on selected endpoint
  const selectedEndpoint = API_ENDPOINTS.find((e) => e.path === endpoint);
  const availableMethods = selectedEndpoint?.methods ?? METHODS;

  // ---- Render --------------------------------------------------------------

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ================================================================== */}
      {/* Left column: Request builder                                       */}
      {/* ================================================================== */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-base">Request</CardTitle>

              {/* Template selector */}
              <div className="flex items-center gap-1.5">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <Select value={template} onValueChange={(v) => { setTemplate(v); applyTemplate(v); }}>
                        <SelectTrigger className="w-[180px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TEMPLATES.map((t) => (
                            <SelectItem key={t.label} value={t.label}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Pre-built request templates that fill in the endpoint, method, and body for common API actions.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* ---- Endpoint ---- */}
            <div className="space-y-2">
              <FieldLabel
                label="Endpoint"
                tooltip="The API path to send the request to. Select from the list of available OKRunit API endpoints."
              />
              <Select value={endpoint} onValueChange={handleEndpointSelect}>
                <SelectTrigger className="w-full font-mono text-sm [&>span]:text-left [&>span]:truncate">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {API_ENDPOINTS.map((ep) => (
                    <SelectItem key={ep.path} value={ep.path} className="py-2">
                      <div className="flex flex-col gap-0.5 text-left">
                        <span className="font-mono text-sm">{ep.path}</span>
                        <span className="text-[11px] text-muted-foreground">{ep.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* ---- Method ---- */}
            <div className="space-y-2">
              <FieldLabel
                label="Method"
                tooltip="The HTTP method for this request. Available methods depend on the selected endpoint."
              />
              <Select
                value={method}
                onValueChange={(v) => setMethod(v as HttpMethod)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableMethods.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEndpoint && (
                <p className="text-[11px] text-muted-foreground">
                  Supported: {selectedEndpoint.methods.join(", ")}
                </p>
              )}
            </div>

            <Separator />

            {/* ---- Connection selector ---- */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <FieldLabel
                  label="Connection (API Key)"
                  tooltip="Select an existing connection or create a new one. Creating a new connection generates a fresh API key that is automatically filled into the Authorization header."
                  htmlFor="connection"
                />
                {!showCreateConnection && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    onClick={() => { setShowCreateConnection(true); setNewApiKey(null); setNewConnectionName(""); }}
                  >
                    <Plus className="size-3.5" />
                    New
                  </Button>
                )}
              </div>

              {/* Existing connections dropdown — hidden while creating */}
              {!showCreateConnection && connections.length > 0 && (
                <Select onValueChange={selectConnection}>
                  <SelectTrigger id="connection" className="w-full">
                    <SelectValue placeholder="Select a connection..." />
                  </SelectTrigger>
                  <SelectContent>
                    {connections.map((conn) => (
                      <SelectItem key={conn.id} value={conn.id}>
                        <span className="flex items-center gap-2">
                          <span>{conn.name}</span>
                          <span className="text-muted-foreground font-mono text-xs">
                            {conn.api_key_prefix}...
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Inline create connection form */}
              {showCreateConnection && (
                <div className="rounded-lg border border-border bg-white p-4 space-y-3">
                  {!newApiKey ? (
                    <>
                      <p className="text-sm font-medium text-slate-900">Create a new connection</p>
                      <div className="flex gap-2">
                        <Input
                          value={newConnectionName}
                          onChange={(e) => setNewConnectionName(e.target.value)}
                          placeholder="Connection name (e.g. Playground)"
                          className="flex-1 text-sm"
                          onKeyDown={(e) => { if (e.key === "Enter") handleCreateConnection(); }}
                        />
                        <Button
                          size="sm"
                          className="h-9 gap-1.5 shrink-0"
                          onClick={handleCreateConnection}
                          disabled={creatingConnection || !newConnectionName.trim()}
                        >
                          {creatingConnection ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <KeyRound className="size-3.5" />
                          )}
                          {creatingConnection ? "Creating..." : "Create"}
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => setShowCreateConnection(false)}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <Check className="size-4 text-emerald-600 shrink-0" />
                        <p className="text-sm font-medium text-emerald-700">Connection created!</p>
                      </div>
                      <p className="text-xs text-slate-600">API key has been filled into the Authorization header.</p>
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-slate-500">Your API key (save it now — it won&apos;t be shown again):</p>
                        <div className="flex gap-1.5">
                          <code className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-xs text-slate-900 break-all select-all">
                            {newApiKey}
                          </code>
                          <Button
                            type="button"
                            variant={keyCopied ? "default" : "secondary"}
                            size="sm"
                            className="h-9 gap-1.5 shrink-0"
                            onClick={copyApiKey}
                          >
                            {keyCopied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                            {keyCopied ? "Copied!" : "Copy"}
                          </Button>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50"
                        onClick={() => { setShowCreateConnection(false); setNewApiKey(null); }}
                      >
                        Done
                      </Button>
                    </>
                  )}
                </div>
              )}

              {!showCreateConnection && connections.length === 0 && (
                <p className="text-muted-foreground text-xs">
                  No connections yet. Click <strong>New</strong> to create one and get an API key.
                </p>
              )}
            </div>

            <Separator />

            {/* ---- Headers ---- */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FieldLabel
                  label="Headers"
                  tooltip="HTTP headers sent with the request. Content-Type and Authorization are added by default. Click Add to include additional headers."
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={addHeader}
                >
                  <Plus className="size-3.5" />
                  Add
                </Button>
              </div>

              <div className="space-y-2">
                {headers.map((header) => (
                  <div key={header.id} className="flex items-center gap-2">
                    <HeaderNameSelect
                      value={header.key}
                      onChange={(v) => updateHeader(header.id, "key", v)}
                      usedHeaders={headers.map((h) => h.key)}
                    />
                    <Input
                      value={header.value}
                      onChange={(e) =>
                        updateHeader(header.id, "value", e.target.value)
                      }
                      placeholder="Value"
                      className="flex-1 font-mono text-xs"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => removeHeader(header.id)}
                    >
                      <Trash2 className="size-3.5" />
                      <span className="sr-only">Remove header</span>
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* ---- Body (POST / PATCH only) ---- */}
            {(method === "POST" || method === "PATCH") && (
              <>
                <Separator />
                <div className="space-y-2">
                  <FieldLabel
                    label="Request Body (JSON)"
                    tooltip="The JSON data sent with this request. Edit it directly or use a template to pre-fill it. This is the actual payload submitted to the API when you click Send."
                    htmlFor="body"
                  />
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder='{ "key": "value" }'
                    rows={12}
                    className="resize-y font-mono text-xs leading-relaxed"
                  />
                </div>
              </>
            )}

            <Separator />

            {/* ---- Send button ---- */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Button
                    onClick={sendRequest}
                    disabled={sending || !endpoint.trim()}
                    className="w-full gap-2"
                  >
                    <Play className="size-4" />
                    {sending ? "Sending..." : "Send Request"}
                  </Button>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Send this request to the OKRunit API and view the response on the right.
              </TooltipContent>
            </Tooltip>
          </CardContent>
        </Card>

        {/* ---- Code Snippets ---- */}
        <CodeSnippets
          method={method}
          url={fullUrl}
          headers={snippetHeaders}
          body={body}
        />
      </div>

      {/* ================================================================== */}
      {/* Right column: Response viewer                                      */}
      {/* ================================================================== */}
      <div>
        <ResponseViewer response={response} />
      </div>
    </div>
  );
}
