"use client";

import { useState, memo } from "react";
import { useRouter } from "next/navigation";
import {
  Globe,
  Plus,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  X,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WebhookChannel {
  id: string;
  org_id: string;
  name: string;
  url: string;
  http_method: string;
  headers: Record<string, string>;
  payload_template: Record<string, unknown> | null;
  events: string[];
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const EVENT_OPTIONS = [
  { value: "request.created", label: "Request Created", description: "When a new approval request is submitted" },
  { value: "approval.approved", label: "Approved", description: "When a request is approved" },
  { value: "approval.rejected", label: "Rejected", description: "When a request is rejected" },
  { value: "approval.expired", label: "Expired", description: "When a request expires past its deadline" },
  { value: "approval.escalated", label: "Escalated", description: "When a request is escalated" },
  { value: "approval.commented", label: "Commented", description: "When a comment is added to a request" },
] as const;

const HTTP_METHODS = ["POST", "PUT", "PATCH"] as const;

// ---------------------------------------------------------------------------
// Header key-value editor
// ---------------------------------------------------------------------------

function HeaderEditor({
  headers,
  onChange,
}: {
  headers: Record<string, string>;
  onChange: (headers: Record<string, string>) => void;
}) {
  const entries = Object.entries(headers);

  function addHeader() {
    onChange({ ...headers, "": "" });
  }

  function updateKey(oldKey: string, newKey: string, index: number) {
    const newHeaders: Record<string, string> = {};
    let i = 0;
    for (const [k, v] of Object.entries(headers)) {
      if (i === index) {
        newHeaders[newKey] = v;
      } else {
        newHeaders[k] = v;
      }
      i++;
    }
    onChange(newHeaders);
  }

  function updateValue(key: string, value: string, index: number) {
    const newHeaders: Record<string, string> = {};
    let i = 0;
    for (const [k, v] of Object.entries(headers)) {
      newHeaders[k] = i === index ? value : v;
      i++;
    }
    onChange(newHeaders);
  }

  function removeHeader(index: number) {
    const newHeaders: Record<string, string> = {};
    let i = 0;
    for (const [k, v] of Object.entries(headers)) {
      if (i !== index) newHeaders[k] = v;
      i++;
    }
    onChange(newHeaders);
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value], index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            placeholder="Header name"
            value={key}
            onChange={(e) => updateKey(key, e.target.value, index)}
            className="h-8 text-xs flex-1"
          />
          <Input
            placeholder="Value"
            value={value}
            onChange={(e) => updateValue(key, e.target.value, index)}
            className="h-8 text-xs flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => removeHeader(index)}
            className="shrink-0"
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addHeader}
        className="text-xs"
      >
        <Plus className="size-3 mr-1" />
        Add Header
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Webhook Channel Form Dialog
// ---------------------------------------------------------------------------

interface WebhookFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel?: WebhookChannel | null;
  onSave: (channel: WebhookChannel) => void;
}

function WebhookFormDialog({
  open,
  onOpenChange,
  channel,
  onSave,
}: WebhookFormDialogProps) {
  const isEditing = !!channel;

  const [name, setName] = useState(channel?.name ?? "");
  const [url, setUrl] = useState(channel?.url ?? "");
  const [httpMethod, setHttpMethod] = useState<string>(channel?.http_method ?? "POST");
  const [headers, setHeaders] = useState<Record<string, string>>(channel?.headers ?? {});
  const [events, setEvents] = useState<string[]>(channel?.events ?? ["request.created"]);
  const [loading, setLoading] = useState(false);

  // Reset form when dialog opens with new channel
  function resetForm() {
    setName(channel?.name ?? "");
    setUrl(channel?.url ?? "");
    setHttpMethod(channel?.http_method ?? "POST");
    setHeaders(channel?.headers ?? {});
    setEvents(channel?.events ?? ["request.created"]);
  }

  function toggleEvent(value: string) {
    setEvents((prev) =>
      prev.includes(value)
        ? prev.filter((e) => e !== value)
        : [...prev, value],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    if (!url.trim()) {
      toast.error("URL is required");
      return;
    }
    if (events.length === 0) {
      toast.error("Select at least one event");
      return;
    }

    // Clean empty headers
    const cleanHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (k.trim()) cleanHeaders[k.trim()] = v;
    }

    setLoading(true);
    try {
      const endpoint = isEditing
        ? `/api/v1/messaging/webhook/${channel.id}`
        : "/api/v1/messaging/webhook";
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          http_method: httpMethod,
          headers: cleanHeaders,
          events,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? `Failed to ${isEditing ? "update" : "create"} webhook`);
      }

      const { channel: saved } = await res.json();
      toast.success(isEditing ? "Webhook updated" : "Webhook created");
      onSave(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) resetForm();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit Webhook Channel" : "Add Webhook Channel"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the webhook configuration for this notification channel."
                : "Configure a webhook endpoint to receive approval event notifications via HTTP."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                placeholder="e.g. Production Alerts"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL</Label>
              <Input
                id="webhook-url"
                type="url"
                placeholder="https://example.com/webhook"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>

            {/* HTTP Method */}
            <div className="space-y-2">
              <Label>HTTP Method</Label>
              <Select value={httpMethod} onValueChange={setHttpMethod}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Headers */}
            <div className="space-y-2">
              <Label>Custom Headers</Label>
              <HeaderEditor headers={headers} onChange={setHeaders} />
              <p className="text-[11px] text-muted-foreground">
                Add custom headers like Authorization or API keys.
              </p>
            </div>

            {/* Events */}
            <div className="space-y-2">
              <Label>Events</Label>
              <div className="space-y-2">
                {EVENT_OPTIONS.map((event) => {
                  const isSelected = events.includes(event.value);
                  return (
                    <div
                      key={event.value}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                      )}
                      onClick={() => toggleEvent(event.value)}
                    >
                      <Switch
                        checked={isSelected}
                        onCheckedChange={() => toggleEvent(event.value)}
                        className="pointer-events-none"
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{event.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.description}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !name.trim() || !url.trim() || events.length === 0}
            >
              {loading
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save Changes"
                  : "Create Webhook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface WebhookChannelsProps {
  initialChannels: WebhookChannel[];
}

export const WebhookChannels = memo(function WebhookChannels({ initialChannels }: WebhookChannelsProps) {
  const router = useRouter();
  const [channels, setChannels] = useState<WebhookChannel[]>(initialChannels);
  const [formOpen, setFormOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<WebhookChannel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WebhookChannel | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function handleSave(saved: WebhookChannel) {
    if (editingChannel) {
      setChannels((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
      setEditingChannel(null);
    } else {
      setChannels((prev) => [saved, ...prev]);
    }
    router.refresh();
  }

  function handleEdit(channel: WebhookChannel) {
    setEditingChannel(channel);
    setFormOpen(true);
  }

  async function handleToggleActive(channel: WebhookChannel) {
    const newActive = !channel.is_active;
    // Optimistic update
    setChannels((prev) =>
      prev.map((c) => (c.id === channel.id ? { ...c, is_active: newActive } : c)),
    );

    try {
      const res = await fetch(`/api/v1/messaging/webhook/${channel.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: newActive }),
      });
      if (!res.ok) {
        // Rollback
        setChannels((prev) =>
          prev.map((c) => (c.id === channel.id ? { ...c, is_active: !newActive } : c)),
        );
        toast.error("Failed to update webhook status");
        return;
      }
      toast.success(newActive ? "Webhook activated" : "Webhook paused");
    } catch {
      setChannels((prev) =>
        prev.map((c) => (c.id === channel.id ? { ...c, is_active: !newActive } : c)),
      );
      toast.error("Failed to update webhook status");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/v1/messaging/webhook/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "Failed to deactivate webhook");
      }
      setChannels((prev) => prev.filter((c) => c.id !== deleteTarget.id));
      toast.success("Webhook channel removed");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove webhook");
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleCopyUrl(id: string, url: string) {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function truncateUrl(url: string, maxLen = 50): string {
    try {
      const u = new URL(url);
      const display = u.hostname + u.pathname;
      return display.length > maxLen ? display.slice(0, maxLen) + "..." : display;
    } catch {
      return url.length > maxLen ? url.slice(0, maxLen) + "..." : url;
    }
  }

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-orange-500/10">
            <Globe className="size-4 text-orange-500" strokeWidth={1.75} />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Custom Webhooks</h2>
            <p className="text-xs text-muted-foreground">
              Send approval events to any HTTP endpoint
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingChannel(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-3.5 mr-1.5" />
          Add Webhook
        </Button>
      </div>

      {/* Channel list */}
      {channels.length > 0 ? (
        <div className="space-y-2">
          {channels.map((channel) => (
            <Card
              key={channel.id}
              className={cn(
                "border-0 shadow-[var(--shadow-card)]",
                !channel.is_active && "opacity-60",
              )}
            >
              <CardContent className="py-3 px-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Left: Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                      <Globe className="size-4 text-orange-500" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {channel.name}
                        </span>
                        <Badge
                          variant={channel.is_active ? "default" : "secondary"}
                        >
                          {channel.is_active ? "Active" : "Paused"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {channel.http_method}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <button
                          type="button"
                          onClick={() => handleCopyUrl(channel.id, channel.url)}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                          title="Click to copy URL"
                        >
                          <span className="truncate max-w-[300px] font-mono">
                            {truncateUrl(channel.url)}
                          </span>
                          {copiedId === channel.id ? (
                            <Check className="size-3 text-emerald-500 shrink-0" />
                          ) : (
                            <Copy className="size-3 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {channel.events.map((event) => (
                          <Badge
                            key={event}
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="icon-sm"
                      title="Edit webhook"
                      onClick={() => handleEdit(channel)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      title={channel.is_active ? "Pause webhook" : "Activate webhook"}
                      onClick={() => handleToggleActive(channel)}
                    >
                      {channel.is_active ? (
                        <PowerOff className="size-3.5" />
                      ) : (
                        <Power className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="text-destructive hover:bg-destructive/10 cursor-pointer"
                      title="Remove webhook"
                      onClick={() => setDeleteTarget(channel)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border/60 py-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
              <Globe className="size-5 text-orange-500" />
            </div>
            <div className="space-y-1 max-w-sm">
              <p className="text-sm font-medium text-foreground">
                No webhook channels configured
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add a webhook to send approval events to any HTTP endpoint, such
                as a monitoring tool, internal API, or automation platform.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="mt-1"
              onClick={() => {
                setEditingChannel(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-3.5 mr-1.5" />
              Add Webhook
            </Button>
          </div>
        </div>
      )}

      {/* Form dialog */}
      <WebhookFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditingChannel(null);
        }}
        channel={editingChannel}
        onSave={handleSave}
      />

      {/* Delete confirmation */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Webhook Channel</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.name}
              </span>
              ? This webhook will stop receiving approval event notifications.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              disabled={deleteLoading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
              className="cursor-pointer"
            >
              {deleteLoading ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});
