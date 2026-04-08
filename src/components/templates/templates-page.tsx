"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Approval Templates Page
// Displays a grid of approval templates with create, edit, and delete actions.
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState, useTransition } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  FileText,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateFormDialog } from "@/components/templates/template-form-dialog";

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
  created_at: string;
  updated_at: string;
}

interface TemplatesPageProps {
  orgId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function priorityBadgeClasses(priority: string): string {
  switch (priority) {
    case "critical":
      return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
    case "high":
      return "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400";
    case "medium":
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/50 dark:text-yellow-400";
    case "low":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400";
    default:
      return "";
  }
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-5 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-[60px] rounded-full" />
                <Skeleton className="h-5 w-[50px] rounded-full" />
              </div>
              <Skeleton className="h-4 w-1/2" />
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
          </p>
        </div>
        <Button onClick={handleCreate} className="gap-1.5">
          <Plus className="size-4" />
          Create Template
        </Button>
      </div>

      {/* Template Grid or Empty State */}
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
          <Button onClick={handleCreate} variant="outline" className="gap-1.5">
            <Plus className="size-4" />
            Create Template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="group rounded-xl border border-border/50 bg-[var(--card)] p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground leading-tight">
                  {template.name}
                </h3>
                <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
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

              {template.description && (
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
                  {template.description}
                </p>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {template.action_type && (
                  <Badge variant="outline" className="text-[11px]">
                    {template.action_type}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={`text-[11px] ${priorityBadgeClasses(template.default_priority)}`}
                >
                  {template.default_priority}
                </Badge>
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3" />
                  {template.assigned_approvers.length} approver{template.assigned_approvers.length !== 1 ? "s" : ""}
                </span>
                <span title={new Date(template.created_at).toLocaleString()}>
                  {formatDistanceToNow(new Date(template.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          ))}
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
