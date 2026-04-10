"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Approval Templates Page
// Displays a grid of approval templates with create, edit, and delete actions.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  Clock,
  FileText,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Type,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PriorityBadge } from "@/components/approvals/priority-badge";
import { TemplateFormDialog } from "@/components/templates/template-form-dialog";
import type { ApprovalPriority } from "@/lib/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ApprovalTemplate {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  title_pattern: string | null;
  action_type: string | null;
  default_priority: string;
  assigned_approvers: string[];
  callback_url_pattern: string | null;
  target_app: string;
  created_at: string;
  updated_at: string;
}

const APP_LABELS: Record<string, string> = {
  any: "API / Other",
  n8n: "n8n",
  zapier: "Zapier",
  make: "Make",
};

interface TemplatesPageProps {
  orgId: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TemplatesPage({ orgId }: TemplatesPageProps) {
  const [templates, setTemplates] = useState<ApprovalTemplate[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ApprovalTemplate | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fetchTemplates = useCallback(async () => {
    const res = await fetch("/api/v1/templates");
    if (!res.ok) return;
    const data = await res.json();
    setTemplates(data.data ?? data);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = useCallback(() => {
    setEditingTemplate(null);
    setDialogOpen(true);
  }, []);

  const handleEdit = useCallback((template: ApprovalTemplate) => {
    setEditingTemplate(template);
    setDialogOpen(true);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      setDeletingId(id);
      startTransition(async () => {
        const res = await fetch(`/api/v1/templates/${id}`, { method: "DELETE" });
        setDeletingId(null);
        if (res.ok) {
          toast.success("Template deleted");
          setTemplates((prev) => (prev ? prev.filter((t) => t.id !== id) : prev));
        } else {
          toast.error("Failed to delete template");
        }
      });
    },
    [],
  );

  const handleSaved = useCallback(
    (saved: ApprovalTemplate) => {
      setDialogOpen(false);
      setEditingTemplate(null);
      // Optimistic update
      setTemplates((prev) => {
        if (!prev) return [saved];
        const idx = prev.findIndex((t) => t.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [saved, ...prev];
      });
    },
    [],
  );

  // Loading skeleton
  if (templates === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-[200px]" />
          <Skeleton className="h-9 w-[150px]" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 flex items-center gap-4">
              <Skeleton className="size-9 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <div className="flex gap-2">
                <Skeleton className="h-5 w-[60px] rounded-full" />
                <Skeleton className="h-5 w-[50px] rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Approval Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pre-configured templates to speed up approval request creation.
            When a template is selected in n8n, Zapier, or Make, its defaults (title, priority, action type, approvers) are applied server-side.
            Leave matching fields blank in the integration step if you want the template values to win.
          </p>
        </div>
        <Button data-tour="create-template-btn" onClick={handleCreate} className="gap-1.5">
          <Plus className="size-4" />
          Create Template
        </Button>
      </div>

      {/* Template List or Empty State */}
      {templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 rounded-xl border-0 py-20 text-center shadow-[var(--shadow-card)]">
          <div className="empty-state-icon rounded-2xl p-5">
            <FileText className="size-9 text-muted-foreground/70" />
          </div>
          <div className="space-y-2">
            <p className="text-base font-semibold text-foreground">No templates yet</p>
            <p className="text-sm text-muted-foreground">
              Create one to speed up your workflows.
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => {
            const priorityColor = {
              critical: "border-l-red-400",
              high: "border-l-orange-400",
              medium: "border-l-yellow-400",
              low: "border-l-emerald-400",
            }[template.default_priority] ?? "border-l-zinc-300";

            return (
              <Card
                key={template.id}
                className={`group/card border-0 border-l-4 card-interactive transition-all ${priorityColor}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Template icon */}
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-950/50">
                    <FileText className="size-4 text-violet-600 dark:text-violet-400" />
                  </div>

                  {/* Main content */}
                  <div className="min-w-0 flex-1">
                    {/* Title row */}
                    <h3 className="text-sm font-medium text-foreground line-clamp-1">
                      {template.name}
                    </h3>

                    {/* Metadata row */}
                    <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                      {template.description && (
                        <span className="line-clamp-1">{template.description}</span>
                      )}
                      {template.description && (template.title_pattern || template.action_type || template.callback_url_pattern) && (
                        <span className="text-muted-foreground/40">|</span>
                      )}
                      {template.title_pattern && (
                        <span className="flex items-center gap-1">
                          <Type className="size-3 shrink-0" />
                          {template.title_pattern}
                        </span>
                      )}
                      {template.title_pattern && (template.action_type || template.callback_url_pattern) && (
                        <span className="text-muted-foreground/40">|</span>
                      )}
                      {template.callback_url_pattern && (
                        <span className="flex items-center gap-1 truncate max-w-[200px]">
                          <Link2 className="size-3 shrink-0" />
                          Callback URL
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right side badges & actions */}
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {template.target_app && (
                      <span className="rounded bg-blue-100 dark:bg-blue-950/50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-400">
                        {APP_LABELS[template.target_app] ?? template.target_app}
                      </span>
                    )}
                    {template.action_type && (
                      <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {template.action_type}
                      </span>
                    )}
                    <PriorityBadge priority={template.default_priority as ApprovalPriority} />
                    {template.assigned_approvers.length > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="size-3" />
                        {template.assigned_approvers.length}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground" title={new Date(template.created_at).toLocaleString()}>
                      <Clock className="size-3" />
                      {formatDistanceToNow(new Date(template.created_at), { addSuffix: true })}
                    </span>

                    {/* Edit / Delete (visible on hover) */}
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0"
                        onClick={() => handleEdit(template)}
                        aria-label={`Edit ${template.name}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="size-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(template.id)}
                        disabled={deletingId === template.id}
                        aria-label={`Delete ${template.name}`}
                      >
                        {deletingId === template.id ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <TemplateFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={editingTemplate}
        onSaved={handleSaved}
      />
    </div>
  );
}
