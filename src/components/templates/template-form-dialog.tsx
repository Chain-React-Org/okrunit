"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Template Form Dialog
// Dialog for creating or editing an approval template.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ApprovalTemplate } from "@/components/templates/templates-page";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TemplateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ApprovalTemplate | null;
  onSaved: (template: ApprovalTemplate) => void;
}

interface FormState {
  name: string;
  description: string;
  title_pattern: string;
  action_type: string;
  default_priority: string;
  assigned_approvers: string;
  callback_url_pattern: string;
  target_app: string;
}

const PRIORITIES = ["low", "medium", "high", "critical"] as const;

const TARGET_APPS = [
  { value: "any", label: "API / Other" },
  { value: "n8n", label: "n8n" },
  { value: "zapier", label: "Zapier" },
  { value: "make", label: "Make" },
] as const;

// Which optional fields each app supports beyond name + description + title_pattern.
// "any" shows all fields since the raw API accepts everything.
const APP_FIELDS: Record<string, Set<string>> = {
  any: new Set(["action_type", "default_priority", "assigned_approvers", "callback_url_pattern"]),
  n8n: new Set(["action_type", "default_priority", "assigned_approvers", "callback_url_pattern"]),
  zapier: new Set(["assigned_approvers"]),
  make: new Set(["callback_url_pattern"]),
};

const DEFAULT_FORM: FormState = {
  name: "",
  description: "",
  title_pattern: "",
  action_type: "",
  default_priority: "medium",
  assigned_approvers: "",
  callback_url_pattern: "",
  target_app: "any",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplateFormDialog({
  open,
  onOpenChange,
  template,
  onSaved,
}: TemplateFormDialogProps) {
  const isEditing = template !== null;
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isPending, startTransition] = useTransition();

  // Reset form when dialog opens or template changes
  useEffect(() => {
    if (open) {
      if (template) {
        setForm({
          name: template.name,
          description: template.description ?? "",
          title_pattern: template.title_pattern ?? "",
          action_type: template.action_type ?? "",
          default_priority: template.default_priority,
          assigned_approvers: template.assigned_approvers.join(", "),
          callback_url_pattern: template.callback_url_pattern ?? "",
          target_app: template.target_app ?? "any",
        });
      } else {
        setForm(DEFAULT_FORM);
      }
    }
  }, [open, template]);

  const updateField = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      if (!form.name.trim()) {
        toast.error("Name is required");
        return;
      }

      startTransition(async () => {
        const approvers = form.assigned_approvers
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        const fields = APP_FIELDS[form.target_app] ?? APP_FIELDS.n8n;

        const body: Record<string, unknown> = {
          name: form.name.trim(),
          target_app: form.target_app,
        };
        if (form.description.trim()) body.description = form.description.trim();
        if (form.title_pattern.trim()) body.title_pattern = form.title_pattern.trim();
        if (fields.has("default_priority")) body.default_priority = form.default_priority;
        if (fields.has("assigned_approvers")) body.assigned_approvers = approvers;
        if (fields.has("action_type") && form.action_type.trim()) body.action_type = form.action_type.trim();
        if (fields.has("callback_url_pattern") && form.callback_url_pattern.trim()) body.callback_url_pattern = form.callback_url_pattern.trim();

        const url = isEditing
          ? `/api/v1/templates/${template.id}`
          : "/api/v1/templates";
        const method = isEditing ? "PATCH" : "POST";

        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const saved = await res.json();
          toast.success(isEditing ? "Template updated" : "Template created");
          onSaved(saved.data ?? saved);
        } else {
          const err = await res.json().catch(() => null);
          toast.error(err?.error ?? "Failed to save template");
        }
      });
    },
    [form, isEditing, template, onSaved],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Template" : "Create Template"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update the template configuration."
              : "Define a reusable template for approval requests."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Target App */}
          <div className="space-y-2">
            <Label htmlFor="template-target-app">Target App</Label>
            <Select
              value={form.target_app}
              onValueChange={(v) => updateField("target_app", v)}
            >
              <SelectTrigger id="template-target-app" className="bg-white dark:bg-card text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGET_APPS.map((app) => (
                  <SelectItem key={app.value} value={app.value}>
                    {app.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Choose which integration this template is for. Only fields supported by the selected app will be shown. &quot;API / Other&quot; templates are for direct API usage and won&apos;t appear in n8n, Zapier, or Make dropdowns.
            </p>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="template-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="template-name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="e.g., Production Deploy"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="template-description">Description</Label>
            <Textarea
              id="template-description"
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="A brief description of this template"
              rows={2}
            />
          </div>

          {/* Title Pattern */}
          <div className="space-y-2">
            <Label htmlFor="template-title-pattern">Title Pattern</Label>
            <Input
              id="template-title-pattern"
              value={form.title_pattern}
              onChange={(e) => updateField("title_pattern", e.target.value)}
              placeholder="e.g., Deploy {service} to {environment}"
            />
            <p className="text-xs text-muted-foreground">
              Use {"{variable}"} placeholders, e.g., &quot;Deploy {"{service}"} to {"{environment}"}&quot;
            </p>
          </div>

          {/* Action Type (n8n, any) */}
          {(APP_FIELDS[form.target_app] ?? APP_FIELDS.n8n).has("action_type") && (
            <div className="space-y-2">
              <Label htmlFor="template-action-type">Action Type</Label>
              <Input
                id="template-action-type"
                value={form.action_type}
                onChange={(e) => updateField("action_type", e.target.value)}
                placeholder="e.g., deploy, database_change, access_request"
              />
            </div>
          )}

          {/* Default Priority (n8n, any) */}
          {(APP_FIELDS[form.target_app] ?? APP_FIELDS.n8n).has("default_priority") && (
            <div className="space-y-2">
              <Label htmlFor="template-priority">Default Priority</Label>
              <Select
                value={form.default_priority}
                onValueChange={(v) => updateField("default_priority", v)}
              >
                <SelectTrigger id="template-priority" className="bg-white dark:bg-card text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Assigned Approvers (n8n, zapier, any) */}
          {(APP_FIELDS[form.target_app] ?? APP_FIELDS.n8n).has("assigned_approvers") && (
            <div className="space-y-2">
              <Label htmlFor="template-approvers">Assigned Approvers</Label>
              <Input
                id="template-approvers"
                value={form.assigned_approvers}
                onChange={(e) => updateField("assigned_approvers", e.target.value)}
                placeholder="user-id-1, user-id-2"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated list of user IDs or email addresses.
              </p>
            </div>
          )}

          {/* Callback URL Pattern (n8n, make, any) */}
          {(APP_FIELDS[form.target_app] ?? APP_FIELDS.n8n).has("callback_url_pattern") && (
            <div className="space-y-2">
              <Label htmlFor="template-callback">Callback URL Pattern</Label>
              <Input
                id="template-callback"
                value={form.callback_url_pattern}
                onChange={(e) => updateField("callback_url_pattern", e.target.value)}
                placeholder="https://api.example.com/webhooks/approval"
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="bg-green-600 text-white hover:bg-green-700">
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                "Update Template"
              ) : (
                "Create Template"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
