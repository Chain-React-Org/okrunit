"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as RadixDialog, VisuallyHidden } from "radix-ui";
import {
  ClipboardList,
  Home,
  Settings,
  Users,
  UsersRound,
  Key,
  Route,
  BarChart3,
  GitBranch,
  CreditCard,
  Shield,
  Search,
  FileText,
  Bell,
  MessageSquare,
  Bug,
  LineChart,
  Building2,
  Palette,
  Lock,
  UserPlus,
  Mail,
  Webhook,
  Timer,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface CommandPaletteProps {
  orgId: string;
}

const PAGES = [
  // Navigation
  { name: "Overview", href: "/org/overview", icon: Home, section: "Navigate", keywords: "dashboard home" },
  { name: "Requests", href: "/requests", icon: ClipboardList, section: "Navigate", keywords: "approvals pending review" },
  { name: "Connections", href: "/requests/connections", icon: Key, section: "Navigate", keywords: "api keys integrations webhooks" },
  { name: "Routes", href: "/requests/routes", icon: Route, section: "Navigate", keywords: "routing flows paths" },
  { name: "Rules", href: "/requests/rules", icon: GitBranch, section: "Navigate", keywords: "automation auto-approve conditions" },
  { name: "Messaging", href: "/requests/messaging", icon: MessageSquare, section: "Navigate", keywords: "slack discord telegram teams notifications chat" },
  { name: "Analytics", href: "/requests/analytics", icon: BarChart3, section: "Navigate", keywords: "stats metrics charts reports" },
  { name: "SLA Compliance", href: "/requests/sla", icon: LineChart, section: "Navigate", keywords: "service level agreement response time" },
  { name: "Teams", href: "/org/teams", icon: UsersRound, section: "Navigate", keywords: "groups departments" },
  { name: "Members", href: "/org/members", icon: Users, section: "Navigate", keywords: "people users team" },
  { name: "Invites", href: "/org/invites", icon: UserPlus, section: "Navigate", keywords: "invite send invitation pending" },
  { name: "Custom Roles", href: "/org/roles", icon: Shield, section: "Navigate", keywords: "permissions access control" },
  { name: "Organizations", href: "/org/organizations", icon: Building2, section: "Navigate", keywords: "org switch workspace" },
  { name: "Subscription", href: "/org/subscription", icon: CreditCard, section: "Navigate", keywords: "billing plan pricing upgrade payment" },
  { name: "Manage Billing", href: "/org/billing", icon: CreditCard, section: "Navigate", keywords: "payment methods cards invoices receipts" },
  // Settings
  { name: "Org Settings", href: "/org/settings", icon: Settings, section: "Settings", keywords: "organization name logo configure" },
  { name: "Account Settings", href: "/settings/account", icon: Settings, section: "Settings", keywords: "profile email password name avatar" },
  { name: "Appearance", href: "/settings/account", icon: Palette, section: "Settings", keywords: "theme dark light mode color" },
  { name: "Notification Preferences", href: "/settings/notifications", icon: Bell, section: "Settings", keywords: "alerts email push digest quiet hours" },
  { name: "Notification History", href: "/settings/notifications", icon: Bell, section: "Settings", keywords: "past alerts messages" },
  { name: "Security", href: "/settings/account", icon: Lock, section: "Settings", keywords: "password mfa 2fa two-factor authentication webauthn passkey" },
  { name: "Email Settings", href: "/org/settings", icon: Mail, section: "Settings", keywords: "email notifications sender" },
  { name: "Webhooks", href: "/requests/connections", icon: Webhook, section: "Settings", keywords: "webhook endpoint callback url" },
  { name: "Auto-Approval Rules", href: "/requests/rules", icon: Timer, section: "Settings", keywords: "automatic approve trust level schedule" },
  // Admin
  { name: "Audit Log", href: "/requests/audit-log", icon: FileText, section: "Admin", keywords: "history activity events trail" },
  { name: "Error Monitor", href: "/admin/errors", icon: Bug, section: "Admin", keywords: "errors bugs exceptions sentry monitoring" },
];

interface ApprovalResult {
  id: string;
  title: string;
  status: string;
  priority: string;
}

export function CommandPalette({ orgId }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [approvals, setApprovals] = useState<ApprovalResult[]>([]);
  const router = useRouter();

  // Toggle on Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Search approvals when query changes
  useEffect(() => {
    if (!search || search.length < 2) {
      setApprovals([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("approval_requests")
          .select("id, title, status, priority")
          .ilike("title", `%${search}%`)
          .order("created_at", { ascending: false })
          .limit(5);
        setApprovals(data ?? []);
      } catch {
        // Silently fail
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [search]);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    setSearch("");
    command();
  }, []);

  const statusColor: Record<string, string> = {
    pending: "text-amber-500",
    approved: "text-emerald-500",
    rejected: "text-red-500",
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Command palette"
      className="fixed inset-0 z-[100]"
    >
      {/* Hidden title for accessibility (required by Radix Dialog) */}
      <VisuallyHidden.Root>
        <RadixDialog.Title>Search commands</RadixDialog.Title>
        <RadixDialog.Description>
          Search pages, approvals, and navigate the app
        </RadixDialog.Description>
      </VisuallyHidden.Root>

      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[20%] z-[101] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-border bg-white shadow-2xl dark:bg-card sm:w-full">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <Search className="size-4 text-muted-foreground" />
          <Command.Input
            value={search}
            onValueChange={setSearch}
            placeholder="Search pages, approvals..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
            ESC
          </kbd>
        </div>

        <Command.List className="max-h-[320px] overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          {/* Approval results */}
          {approvals.length > 0 && (
            <Command.Group heading="Approvals">
              {approvals.map((a) => (
                <Command.Item
                  key={a.id}
                  value={`approval-${a.title}`}
                  onSelect={() =>
                    runCommand(() => router.push(`/requests?highlight=${a.id}`))
                  }
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer data-[selected=true]:bg-muted"
                >
                  <ClipboardList className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{a.title}</span>
                  <span className={`text-xs capitalize ${statusColor[a.status] ?? "text-muted-foreground"}`}>
                    {a.status}
                  </span>
                </Command.Item>
              ))}
            </Command.Group>
          )}

          {/* Page navigation */}
          {["Navigate", "Settings", "Admin"].map((section) => {
            const items = PAGES.filter((p) => p.section === section);
            if (items.length === 0) return null;
            return (
              <Command.Group key={section} heading={section}>
                {items.map((page) => {
                  const Icon = page.icon;
                  return (
                    <Command.Item
                      key={page.name}
                      value={`${page.name} ${page.keywords}`}
                      onSelect={() => runCommand(() => router.push(page.href))}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer data-[selected=true]:bg-muted"
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span>{page.name}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            );
          })}
        </Command.List>

        <div className="border-t px-4 py-2">
          <p className="text-[10px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">↑↓</kbd> navigate
            {" "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">↵</kbd> select
            {" "}
            <kbd className="rounded border border-border bg-muted px-1 py-0.5 text-[10px]">esc</kbd> close
          </p>
        </div>
      </div>
    </Command.Dialog>
  );
}
