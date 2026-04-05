"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Circle,
  ClipboardList,
  Clock3,
  Filter,
  Home,
  KeyRound,
  Menu,
  MessageSquare,
  Plus,
  Route,
  Settings,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { HeroNav } from "@/components/landing/hero-nav";
import { SiteFooter } from "@/components/marketing/site-footer";
import { PriorityBadge } from "@/components/approvals/priority-badge";
import { SOURCE_CONFIG } from "@/components/approvals/source-icons";
import { PLATFORM_ICONS } from "@/components/messaging/platform-card";
import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { ApprovalPriority, MessagingPlatform } from "@/lib/types/database";
import type { LucideIcon } from "lucide-react";

interface LandingPageProps {
  user: { email: string; full_name: string | null } | null;
}

const sourceAssets = {
  zapier: {
    label: "Zapier",
    src: "/logos/platforms/zapier.png",
    chipBg: "bg-orange-50",
  },
  make: {
    label: "Make",
    src: "/logos/platforms/make.png",
    chipBg: "bg-violet-50",
  },
  n8n: {
    label: "n8n",
    src: "/logos/platforms/n8n.png",
    chipBg: "bg-rose-50",
  },
  github: {
    label: "GitHub Actions",
    src: "/logos/platforms/github.png",
    chipBg: "bg-slate-50",
  },
  windmill: {
    label: "Windmill",
    src: "/logos/platforms/windmill.png",
    chipBg: "bg-sky-50",
  },
} as const;

const marqueeIntegrations = [
  { label: "Zapier", src: "/logos/platforms/zapier.png" },
  { label: "Make", src: "/logos/platforms/make.png" },
  { label: "n8n", src: "/logos/platforms/n8n.png" },
  { label: "GitHub Actions", src: "/logos/platforms/github.png" },
  { label: "Windmill", src: "/logos/platforms/windmill.png" },
  { label: "Temporal", src: "/logos/platforms/temporal.png" },
  { label: "Dagster", src: "/logos/platforms/dagster.png" },
  { label: "Pipedream", src: "/logos/platforms/pipedream.png" },
  { label: "Prefect", src: "/logos/platforms/prefect.png" },
  { label: "Slack", src: "/logos/platforms/slack.png" },
  { label: "Discord", src: "/logos/platforms/discord.png" },
  { label: "Microsoft Teams", src: "/logos/platforms/teams.png" },
  { label: "Telegram", src: "/logos/platforms/telegram.png" },
  { label: "monday.com", src: "/logos/platforms/monday.png" },
];

type ProductSource = keyof typeof sourceAssets;
type RequestStatus = "pending" | "approved" | "rejected";
type MetricTone = "amber" | "emerald" | "blue";

interface RequestItem {
  title: string;
  source: ProductSource;
  priority: ApprovalPriority;
  status: RequestStatus;
  age: string;
  actionType: string;
  owner: string;
}

interface MetricItem {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  tone: MetricTone;
}

interface QuickActionItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: string;
}

interface AuditEntry {
  time: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actor: string;
  ip: string;
  details?: string;
}

const sourceOrder: ProductSource[] = ["zapier", "make", "n8n", "github", "windmill"];

const heroMetrics: MetricItem[] = [
  {
    title: "Pending Requests",
    value: "12",
    subtitle: "Awaiting decision",
    icon: Clock3,
    tone: "amber",
  },
  {
    title: "Approved Today",
    value: "184",
    subtitle: "92% approval rate",
    icon: CheckCircle2,
    tone: "emerald",
  },
  {
    title: "Active Connections",
    value: "8",
    subtitle: "Zapier, Make, n8n, GitHub",
    icon: KeyRound,
    tone: "blue",
  },
];

const queueAttention: RequestItem[] = [
  {
    title: "Deploy v3.2 to production",
    source: "github",
    priority: "critical",
    status: "pending",
    age: "2m ago",
    actionType: "deploy.production",
    owner: "Ops",
  },
  {
    title: "Delete 10,247 stale user records",
    source: "zapier",
    priority: "high",
    status: "pending",
    age: "5m ago",
    actionType: "bulk_delete",
    owner: "Operations",
  },
  {
    title: "Update billing address for OKrunit",
    source: "make",
    priority: "medium",
    status: "pending",
    age: "9m ago",
    actionType: "crm.update",
    owner: "Revenue",
  },
];

const queueResolved: RequestItem[] = [
  {
    title: "Rotate webhook signing secret",
    source: "windmill",
    priority: "medium",
    status: "approved",
    age: "14m ago",
    actionType: "key.rotate",
    owner: "Platform",
  },
  {
    title: "Send bulk notification to 50k users",
    source: "n8n",
    priority: "high",
    status: "rejected",
    age: "18m ago",
    actionType: "notification.bulk",
    owner: "Lifecycle",
  },
  {
    title: "Archive 1,200 inactive accounts",
    source: "zapier",
    priority: "medium",
    status: "approved",
    age: "22m ago",
    actionType: "account.archive",
    owner: "Operations",
  },
];

const quickActions: QuickActionItem[] = [
  {
    href: "/requests",
    label: "View pending requests",
    icon: ClipboardList,
    badge: "12",
  },
  {
    href: "/connections",
    label: "Create connection",
    icon: Plus,
  },
  {
    href: "/org/invites",
    label: "Invite team member",
    icon: UserPlus,
  },
  {
    href: "/playground",
    label: "API Playground",
    icon: KeyRound,
  },
];

const approvalStateItems: RequestItem[] = [
  {
    title: "Run nightly customer export",
    source: "make",
    priority: "medium",
    status: "approved",
    age: "27m ago",
    actionType: "export.customer",
    owner: "Revenue",
  },
  {
    title: "Purge abandoned trial workspaces",
    source: "zapier",
    priority: "high",
    status: "rejected",
    age: "41m ago",
    actionType: "workspace.purge",
    owner: "Support",
  },
  {
    title: "Grant finance role to contractor",
    source: "github",
    priority: "critical",
    status: "pending",
    age: "1h ago",
    actionType: "role.assign",
    owner: "Security",
  },
];

const queueDeepDiveAttention: RequestItem[] = [
  ...queueAttention,
  {
    title: "Rotate production database password",
    source: "windmill",
    priority: "critical",
    status: "pending",
    age: "12m ago",
    actionType: "db.rotate",
    owner: "Platform",
  },
];

const queueDeepDiveResolved: RequestItem[] = [
  ...queueResolved,
  {
    title: "Re-run billing sync for Q2 invoices",
    source: "make",
    priority: "low",
    status: "approved",
    age: "31m ago",
    actionType: "billing.sync",
    owner: "Finance",
  },
];

const routePlatforms: Record<
  MessagingPlatform,
  { label: string; color: string }
> = {
  email: { label: "Email", color: "#059669" },
  slack: { label: "Slack", color: "#4A154B" },
  discord: { label: "Discord", color: "#5865F2" },
  teams: { label: "Microsoft Teams", color: "#6264A7" },
  telegram: { label: "Telegram", color: "#0088CC" },
};

const routingOutcomes: RequestItem[] = [
  {
    title: "Deploy v3.2 to production",
    source: "github",
    priority: "critical",
    status: "pending",
    age: "2m ago",
    actionType: "deploy.production",
    owner: "#ops-critical",
  },
  {
    title: "Archive 1,200 inactive accounts",
    source: "zapier",
    priority: "medium",
    status: "approved",
    age: "22m ago",
    actionType: "account.archive",
    owner: "RevOps",
  },
  {
    title: "Send bulk notification to 50k users",
    source: "n8n",
    priority: "high",
    status: "rejected",
    age: "18m ago",
    actionType: "notification.bulk",
    owner: "Lifecycle",
  },
];

const auditEntries: AuditEntry[] = [
  {
    time: "1m ago",
    action: "approval.approve",
    resourceType: "approval_request",
    resourceId: "req_01HZZ9V4V4S9Y6WQJ3",
    actor: "User: sarah.k",
    ip: "76.29.14.8",
  },
  {
    time: "4m ago",
    action: "flow.update",
    resourceType: "approval_flow",
    resourceId: "flow_prod_deploy",
    actor: "User: mike.r",
    ip: "76.29.14.8",
    details: `{
  "approver_mode": "designated",
  "required_approvals": 2,
  "is_sequential": true
}`,
  },
  {
    time: "7m ago",
    action: "approval.reject",
    resourceType: "approval_request",
    resourceId: "req_01HZZ9S8BEMAZR6Y3Q",
    actor: "User: priya.n",
    ip: "41.82.110.13",
  },
  {
    time: "11m ago",
    action: "route.update",
    resourceType: "messaging_connection",
    resourceId: "slack_ops_critical",
    actor: "User: sarah.k",
    ip: "76.29.14.8",
  },
  {
    time: "14m ago",
    action: "approval.create",
    resourceType: "approval_request",
    resourceId: "req_01HZZ9Q9X31W7V2ZP5",
    actor: "Conn: api_prod",
    ip: "34.221.19.44",
  },
];

function FadeIn({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    let timer: number | undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        timer = window.setTimeout(() => setVisible(true), delay);
        observer.disconnect();
      },
      { threshold: 0.08 },
    );

    observer.observe(element);
    return () => {
      if (timer) window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [delay]);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        visible
          ? "translate-y-0 opacity-100 scale-100 blur-0"
          : "translate-y-8 opacity-0 scale-[0.98] blur-[2px]",
        className,
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

function IntegrationMarquee() {
  // Double the list for seamless loop
  const items = [...marqueeIntegrations, ...marqueeIntegrations];

  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]">
      <div className="flex w-max animate-[lp-marquee_40s_linear_infinite] items-center gap-3 sm:gap-6">
        {items.map((item, i) => (
          <div
            key={`${item.label}-${i}`}
            className="flex items-center gap-2 rounded-full border border-white/70 bg-white/92 px-3 py-1.5 shadow-[0_12px_32px_rgba(15,23,42,0.10)] backdrop-blur-sm sm:gap-2.5 sm:px-4 sm:py-2"
          >
            <Image
              src={item.src}
              alt={item.label}
              width={20}
              height={20}
              className="size-4 object-contain sm:size-5"
            />
            <span className="whitespace-nowrap text-xs font-medium text-slate-700 sm:text-sm">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionEyebrow({ children }: { children: ReactNode }) {
  return (
    <Badge
      variant="outline"
      className="rounded-full border-emerald-200 bg-white/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 shadow-[0_1px_2px_rgba(15,23,42,0.06)]"
    >
      {children}
    </Badge>
  );
}

function SourcePill({
  source,
  showLabel = true,
  size = "md",
}: {
  source: ProductSource;
  showLabel?: boolean;
  size?: "sm" | "md";
}) {
  const config = sourceAssets[source];
  const iconSize = size === "sm" ? 14 : 16;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
        showLabel ? "gap-2 pl-1.5 pr-3" : "p-1.5",
        size === "sm" ? "py-1" : "py-1.5",
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center rounded-full border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]",
          size === "sm" ? "size-6" : "size-7",
          config.chipBg,
        )}
      >
        <Image
          src={config.src}
          alt={config.label}
          width={iconSize}
          height={iconSize}
          className={cn(size === "sm" ? "size-3.5" : "size-4", "object-contain")}
        />
      </span>
      {showLabel && (
        <span className="text-xs font-medium text-slate-700">{config.label}</span>
      )}
    </span>
  );
}

function StatusPill({ status }: { status: RequestStatus }) {
  const config = {
    pending: {
      label: "Pending",
      icon: Clock3,
      className: "border-amber-200 bg-amber-50 text-amber-700",
    },
    approved: {
      label: "Approved",
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    rejected: {
      label: "Rejected",
      icon: XCircle,
      className: "border-red-200 bg-red-50 text-red-700",
    },
  }[status];

  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 border px-2.5 py-1 text-[11px] font-semibold shadow-none",
        config.className,
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

function MetricCard({
  metric,
  className,
}: {
  metric: MetricItem;
  className?: string;
}) {
  const Icon = metric.icon;
  const tone = {
    amber: {
      wrap: "border-amber-200 bg-amber-50",
      icon: "text-amber-600",
      dot: "bg-amber-500",
    },
    emerald: {
      wrap: "border-emerald-200 bg-emerald-50",
      icon: "text-emerald-600",
      dot: "bg-emerald-500",
    },
    blue: {
      wrap: "border-sky-200 bg-sky-50",
      icon: "text-sky-600",
      dot: "bg-sky-500",
    },
  }[metric.tone];

  return (
    <Card
      className={cn(
        "w-full gap-0 rounded-xl border-slate-200/80 bg-white py-0 shadow-[var(--shadow-card)]",
        className,
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {metric.title}
            </p>
            <p className="text-3xl font-semibold leading-none tracking-tight text-foreground">
              {metric.value}
            </p>
          </div>
          <div
            className={cn(
              "flex size-10 items-center justify-center rounded-xl border",
              tone.wrap,
            )}
          >
            <Icon className={cn("size-5", tone.icon)} />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", tone.dot)} />
          <span>{metric.subtitle}</span>
        </div>
      </CardContent>
    </Card>
  );
}

interface SidebarNavItem {
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: string;
}

function SidebarNavButton({ item }: { item: SidebarNavItem }) {
  const Icon = item.icon;

  return (
    <div
      className={cn(
        "group flex w-full cursor-pointer flex-col items-center gap-1.5 py-3 transition-colors",
        item.active ? "text-white" : "text-white/80",
      )}
    >
      <div
        className={cn(
          "relative flex size-9 items-center justify-center rounded-lg transition-colors",
          item.active ? "bg-white/20" : "group-hover:bg-white/15",
        )}
      >
        <Icon className="size-[22px] shrink-0" />
        {item.badge && (
          <span className="absolute -right-1.5 -top-1.5 flex size-[18px] items-center justify-center rounded-full bg-white text-[9px] font-bold text-[var(--sidebar-gradient-to)]">
            {item.badge}
          </span>
        )}
      </div>
      <span
        className={cn(
          "text-[11px] leading-tight",
          item.active ? "font-semibold text-white" : "font-medium",
        )}
      >
        {item.label}
      </span>
    </div>
  );
}

function SidebarContext() {
  const topItem: SidebarNavItem = { label: "Org", icon: Home, active: false };
  const navItems: SidebarNavItem[] = [
    { label: "Requests", icon: ClipboardList, active: true, badge: "12" },
    { label: "Connections", icon: KeyRound, active: false },
    { label: "Routes", icon: Route, active: false },
    { label: "Messaging", icon: MessageSquare, active: false },
    { label: "Analytics", icon: BarChart3, active: false },
    { label: "Settings", icon: Settings, active: false },
  ];

  return (
    <div className="sidebar-icon-bar flex w-20 shrink-0 flex-col items-center text-white">
      {/* Logo */}
      <div className="flex items-center justify-center py-3">
        <Image
          src="/logo-icon.png"
          alt="OKrunit"
          width={56}
          height={56}
          className="size-14 object-contain drop-shadow-md"
        />
      </div>

      {/* First nav item */}
      <SidebarNavButton item={topItem} />

      {/* Divider */}
      <div className="mx-auto my-2 h-px w-7 bg-white/25" />

      {/* Remaining nav items */}
      {navItems.map((item) => (
        <SidebarNavButton key={item.label} item={item} />
      ))}
    </div>
  );
}

function RequestRow({
  item,
  compact = false,
  subdued = false,
  showChevron = true,
}: {
  item: RequestItem;
  compact?: boolean;
  subdued?: boolean;
  showChevron?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-[22px] border border-slate-200/80 bg-white px-3 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:gap-3 sm:px-4 sm:py-4",
        compact && "px-3 py-2.5 sm:px-3.5 sm:py-3",
        subdued && "opacity-80",
      )}
    >
      <SourcePill source={item.source} showLabel={false} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.status === "pending" && (
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full rounded-full bg-amber-400 opacity-75 lp-pulse-dot" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
          )}
          <p className="truncate text-[13px] font-semibold text-slate-900 sm:text-sm">{item.title}</p>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 sm:gap-2 sm:text-xs">
          <span>{sourceAssets[item.source].label}</span>
          <span className="hidden text-slate-300 sm:inline">·</span>
          <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-600 sm:inline">
            {item.actionType}
          </span>
          <span className="text-slate-300">·</span>
          <span>{item.age}</span>
          <span className="hidden text-slate-300 sm:inline">·</span>
          <span className="hidden sm:inline">{item.owner}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <div className="hidden sm:block">
          <PriorityBadge priority={item.priority} />
        </div>
        <StatusPill status={item.status} />
        {showChevron && <ChevronRight className="hidden size-4 text-slate-300 sm:block" />}
      </div>
    </div>
  );
}

function QueuePanel({
  attentionItems,
  resolvedItems,
  title = "Approval Queue",
  description = "Requests grouped the same way the dashboard surfaces them: pending first, resolved beneath.",
}: {
  attentionItems: RequestItem[];
  resolvedItems: RequestItem[];
  title?: string;
  description?: string;
}) {
  return (
    <Card className="overflow-hidden rounded-2xl border-white/70 bg-white/95 py-0 lp-shadow-hero sm:rounded-[32px]">
      <CardHeader className="border-b border-slate-100 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="max-w-lg">
            <CardTitle className="text-base text-slate-950 sm:text-lg">{title}</CardTitle>
            <p className="mt-1 text-xs leading-relaxed text-slate-500 sm:text-sm">{description}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="h-8 justify-start px-0 text-sm text-slate-600 md:justify-center md:px-3"
          >
            <Link href="/requests">
              View all requests
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
          <Badge className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            Needs Your Attention
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
          >
            Live Queue
          </Badge>
          <Badge
            variant="outline"
            className="rounded-full border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
          >
            Status First
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 sm:space-y-6 sm:p-6">
        <section className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-900 sm:text-sm">Needs Your Attention</span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
              {attentionItems.length}
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {attentionItems.map((item) => (
              <RequestRow key={`${item.title}-${item.age}`} item={item} compact />
            ))}
          </div>
        </section>
        <section className="space-y-2 sm:space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-slate-500 sm:text-sm">Previously Resolved</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              {resolvedItems.length}
            </span>
          </div>
          <div className="space-y-2 sm:space-y-3">
            {resolvedItems.map((item) => (
              <RequestRow
                key={`${item.title}-${item.age}`}
                item={item}
                compact
                subdued
                showChevron={false}
              />
            ))}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

function QuickActionsPanel({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[28px] border-white/80 bg-white/95 py-0 lp-shadow-float",
        className,
      )}
    >
      <CardHeader className="border-b border-slate-100 px-5 py-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-slate-950">Quick Actions</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Operational shortcuts from org overview.</p>
          </div>
          <Badge
            variant="outline"
            className="rounded-full border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
          >
            Admin
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-5">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              variant="outline"
              className="h-12 w-full justify-start gap-2 rounded-2xl border-slate-200 bg-white text-left text-sm"
              asChild
            >
              <Link href={action.href}>
                <Icon className="size-4 text-primary" />
                <span>{action.label}</span>
                {action.badge && (
                  <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {action.badge}
                  </span>
                )}
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}

function MetaField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <div className="text-sm font-medium text-slate-900">{children}</div>
    </div>
  );
}

const SOURCE_LANDING_CONFIG: Record<ProductSource, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bgColor: string }> = {
  zapier: SOURCE_CONFIG.zapier,
  make: SOURCE_CONFIG.make,
  n8n: SOURCE_CONFIG.n8n,
  github: { label: "GitHub Actions", icon: ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  ), color: "text-slate-800", bgColor: "bg-slate-100" },
  windmill: SOURCE_CONFIG.windmill,
};

function LandingSourceAvatar({ source, size = "md" }: { source: ProductSource; size?: "sm" | "md" }) {
  const config = SOURCE_LANDING_CONFIG[source];
  const Icon = config.icon;
  const sizeClasses = size === "sm" ? "size-6 rounded" : "size-8 rounded-lg";
  const iconSize = size === "sm" ? "size-3.5" : "size-4.5";

  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", sizeClasses, config.bgColor)}>
      <Icon className={cn(iconSize, config.color)} />
    </span>
  );
}

/** Mimics the real request card from the approval dashboard */
function AppRequestCard({
  item,
  active = false,
}: {
  item: RequestItem;
  active?: boolean;
}) {
  const borderColor = {
    pending: "border-l-amber-400",
    approved: "border-l-emerald-400",
    rejected: "border-l-red-400",
  }[item.status];

  return (
    <div
      className={cn(
        "group/card flex items-center gap-2 border-0 border-l-4 bg-white px-3 py-2.5 shadow-[var(--shadow-card)] transition-all card-interactive sm:gap-3 sm:px-4 sm:py-3",
        borderColor,
        active && "ring-2 ring-primary/20",
      )}
    >
      <LandingSourceAvatar source={item.source} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.status === "pending" && (
            <span className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-amber-500" />
            </span>
          )}
          <p className="line-clamp-1 text-[13px] font-medium text-slate-900 sm:text-sm">{item.title}</p>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-muted-foreground sm:gap-x-2 sm:text-[11px]">
          <span>{SOURCE_LANDING_CONFIG[item.source].label}</span>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <span className="hidden rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 sm:inline">
            {item.actionType}
          </span>
          <span className="text-slate-300">|</span>
          <span>{item.age}</span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1 sm:gap-1.5">
        {item.status === "pending" && active && (
          <>
            <Button variant="success" size="sm" className="h-6 gap-0.5 px-1.5 text-[10px] sm:h-7 sm:gap-1 sm:px-2.5 sm:text-xs">
              <CheckCircle2 className="size-3" />
              <span className="hidden sm:inline">Approve</span>
            </Button>
            <Button variant="destructive" size="sm" className="h-6 gap-0.5 px-1.5 text-[10px] sm:h-7 sm:gap-1 sm:px-2.5 sm:text-xs">
              <XCircle className="size-3" />
              <span className="hidden sm:inline">Reject</span>
            </Button>
          </>
        )}
        <div className="hidden sm:block">
          <PriorityBadge priority={item.priority} />
        </div>
        <StatusPill status={item.status} />
      </div>
    </div>
  );
}

/** Mimics the real request detail slide-out sheet */
function DetailSheetPreview() {
  const approvers = [
    { name: "Sarah K.", state: "done" },
    { name: "Mike R.", state: "next" },
    { name: "Priya N.", state: "waiting" },
  ] as const;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
      {/* Sheet header */}
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-base font-semibold text-slate-950">Deploy v3.2 to production</p>
        <p className="mt-0.5 text-xs text-slate-500">Critical deployment requiring admin approval</p>
      </div>

      {/* Metadata grid — matches real detail panel */}
      <div className="flex-1 space-y-3 overflow-hidden p-4">
        <div className="grid grid-cols-2 gap-2">
          <MetaField label="Status"><StatusPill status="pending" /></MetaField>
          <MetaField label="Priority"><PriorityBadge priority="critical" /></MetaField>
          <MetaField label="Source">
            <div className="flex items-center gap-1.5">
              <LandingSourceAvatar source="github" size="sm" />
              <span className="text-xs">GitHub Actions</span>
            </div>
          </MetaField>
          <MetaField label="Action Type">
            <span className="font-mono text-xs text-slate-700">deploy.production</span>
          </MetaField>
          <MetaField label="Created">2 minutes ago</MetaField>
          <MetaField label="Created By">github-actions-prod</MetaField>
        </div>

        {/* Approval progress — matches real approval chain UI */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-slate-900">2 of 3 approvals</span>
            <span className="text-xs text-slate-500">67%</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full w-2/3 rounded-full bg-emerald-500" />
          </div>
          <div className="mt-2.5 space-y-1.5">
            {approvers.map((a) => (
              <div key={a.name} className="flex items-center gap-2 text-sm">
                {a.state === "done" ? (
                  <CheckCircle2 className="size-3.5 text-emerald-500" />
                ) : a.state === "next" ? (
                  <ArrowRight className="size-3.5 text-sky-600" />
                ) : (
                  <Circle className="size-3.5 text-slate-300" />
                )}
                <span className={cn(a.state === "next" ? "font-semibold text-slate-900" : "text-slate-600", "text-xs")}>
                  {a.name}{a.state === "next" && " (next)"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Comment + decision — matches real UI */}
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Comment (optional)
          </p>
          <div className="mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-400">
            Add a comment about your decision...
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="success" className="h-8 rounded-lg text-xs">
            <CheckCircle2 className="size-3" />
            Approve
          </Button>
          <Button variant="destructive" className="h-8 rounded-lg text-xs">
            <XCircle className="size-3" />
            Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The approval feature section visual — mimics the real app layout: request list + slide-out detail sheet */
function ApprovalFlowVisual() {
  const allItems = [...queueAttention, ...queueResolved.slice(0, 1)];

  return (
    <>
      {/* Desktop: side-by-side layout */}
      <div className="hidden sm:block">
        <ScaledMockup internalWidth={1000}>
          <div className="gk-v2 force-light flex gap-3 overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/80 p-3 shadow-2xl shadow-black/20">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-900">Needs Your Attention</span>
                <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  {queueAttention.length}
                </span>
              </div>
              {allItems.map((item, i) => (
                <AppRequestCard
                  key={`${item.title}-${item.age}`}
                  item={item}
                  active={i === 0}
                />
              ))}
            </div>
            <div className="w-[340px] shrink-0">
              <DetailSheetPreview />
            </div>
          </div>
        </ScaledMockup>
      </div>

      {/* Mobile: stacked layout — list then detail */}
      <div className="sm:hidden">
        <div className="gk-v2 force-light space-y-3 overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/80 p-3 shadow-2xl shadow-black/20">
          <div className="space-y-1.5">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-900">Needs Your Attention</span>
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                {queueAttention.length}
              </span>
            </div>
            {allItems.slice(0, 2).map((item, i) => (
              <AppRequestCard
                key={`${item.title}-${item.age}`}
                item={item}
                active={i === 0}
              />
            ))}
          </div>
          <DetailSheetPreview />
        </div>
      </div>
    </>
  );
}

function RoutingSystemPanel() {
  const SlackIcon = PLATFORM_ICONS.slack;
  const slackMeta = routePlatforms.slack;

  return (
    <div className="space-y-3 sm:space-y-4">
      <Card className="overflow-hidden rounded-2xl border-white/80 bg-white/95 py-0 lp-shadow-panel sm:rounded-[30px]">
        <CardContent className="p-3 sm:p-5">
          <div className="flex items-start gap-3">
            <SourcePill source="github" showLabel={false} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">
                  GitHub Actions / production-deploy
                </span>
                <Badge className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white">
                  Configured
                </Badge>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                  <UserCheck className="size-3" />
                  Sequential: Sarah K. → Mike R.
                </span>
                <span className="text-slate-300">·</span>
                <span>126 requests</span>
                <span className="text-slate-300">·</span>
                <span>Last 3m ago</span>
              </div>
            </div>
            <ChevronRight className="size-4 shrink-0 text-slate-300" />
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Approval Rules
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">2 approvers, sequential order</p>
              <p className="mt-1 text-xs text-slate-500">Admins only, next 100 requests</p>
            </div>
            <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Team Routing
              </p>
              <p className="mt-2 text-sm font-medium text-slate-900">Ops team owns production deploys</p>
              <p className="mt-1 text-xs text-slate-500">Escalate after 5 minutes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-white/80 bg-white/95 py-0 lp-shadow-panel sm:rounded-[30px]">
        <CardContent className="space-y-3 p-3 sm:space-y-4 sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex size-10 items-center justify-center rounded-2xl shadow-sm"
                style={{ backgroundColor: slackMeta.color }}
              >
                <SlackIcon className="size-5 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">#ops-critical</span>
                  <Badge variant="secondary" className="rounded-full px-2.5 py-1 text-[11px]">
                    {slackMeta.label}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500">Primary incident response channel</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="rounded-full border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600"
              >
                <Filter className="size-3" />
                Filtered
              </Badge>
              <Badge className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-white">
                3 sources
              </Badge>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Notify From
            </p>
            <div className="flex flex-wrap gap-2">
              {(["github", "zapier", "n8n"] as ProductSource[]).map((source) => (
                <SourcePill key={source} source={source} size="sm" />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Recent Outcomes
            </p>
            <div className="space-y-3">
              {routingOutcomes.map((item) => (
                <RequestRow
                  key={`${item.title}-${item.age}`}
                  item={item}
                  compact
                  showChevron={false}
                />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function actionVariant(action: string) {
  const normalized = action.toLowerCase();
  if (normalized.includes("reject")) return "destructive";
  if (normalized.includes("approve") || normalized.includes("create")) return "default";
  if (normalized.includes("update")) return "secondary";
  return "outline";
}

function AuditTrailPanel() {
  return (
    <Card className="overflow-hidden rounded-[32px] border-white/80 bg-white/95 py-0 lp-shadow-panel">
      <CardHeader className="border-b border-slate-100 px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <CardTitle className="text-lg text-slate-950">Audit Trail</CardTitle>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              Every decision, flow change, and route update lands in one history view with actor,
              timestamp, resource, and details.
            </p>
          </div>
          <span className="text-sm text-slate-500">5 of 5 entries</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            All actions
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            approval_request
          </div>
        </div>

        <div className="overflow-hidden rounded-[24px] border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="px-4">Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource Type</TableHead>
                <TableHead>Resource ID</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead className="px-4">IP Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditEntries.map((entry) => (
                <Fragment key={entry.resourceId}>
                  <TableRow className="border-slate-200 hover:bg-slate-50/80">
                    <TableCell className="px-4 text-xs text-slate-500">{entry.time}</TableCell>
                    <TableCell>
                      <Badge variant={actionVariant(entry.action)}>{entry.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-700">{entry.resourceType}</TableCell>
                    <TableCell className="max-w-[200px] truncate font-mono text-xs text-slate-500">
                      {entry.resourceId}
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">{entry.actor}</TableCell>
                    <TableCell className="px-4 font-mono text-xs text-slate-500">{entry.ip}</TableCell>
                  </TableRow>
                  {entry.details && (
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="bg-slate-50/70 p-0">
                        <div className="px-6 py-4">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                            Details
                          </p>
                          <pre className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-4 text-xs text-slate-700">
                            {entry.details}
                          </pre>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function AuditCardMobile({ entry }: { entry: AuditEntry }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={actionVariant(entry.action)} className="text-[10px]">{entry.action}</Badge>
        <span className="text-[11px] text-slate-500">{entry.time}</span>
      </div>
      <div className="space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Resource</span>
          <span className="text-slate-700">{entry.resourceType}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">Actor</span>
          <span className="text-slate-700">{entry.actor}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-500">ID</span>
          <span className="max-w-[180px] truncate font-mono text-[10px] text-slate-500">{entry.resourceId}</span>
        </div>
      </div>
      {entry.details && (
        <pre className="overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-2 text-[10px] text-slate-700">
          {entry.details}
        </pre>
      )}
    </div>
  );
}

function MobileAuditVisual() {
  return (
    <>
      {/* Desktop: full table */}
      <div className="hidden sm:block">
        <ScaledMockup internalWidth={900}>
          <div className="gk-v2 force-light relative overflow-hidden rounded-xl bg-white p-1 shadow-2xl shadow-black/20">
            <AuditTrailPanel />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 rounded-b-xl bg-gradient-to-t from-white to-transparent" />
          </div>
        </ScaledMockup>
      </div>

      {/* Mobile: card layout */}
      <div className="sm:hidden">
        <div className="gk-v2 force-light relative overflow-hidden rounded-xl bg-white p-3 shadow-2xl shadow-black/20">
          <div className="mb-3">
            <p className="text-sm font-semibold text-slate-950">Audit Trail</p>
            <p className="mt-0.5 text-xs text-slate-500">Every decision and change in one view.</p>
          </div>
          <div className="space-y-2">
            {auditEntries.slice(0, 3).map((entry) => (
              <AuditCardMobile key={entry.resourceId} entry={entry} />
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-xl bg-gradient-to-t from-white to-transparent" />
        </div>
      </div>
    </>
  );
}

function HeroTopBar() {
  return (
    <div className="flex h-[52px] items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-slate-900">OKrunit</span>
        <ChevronRight className="size-3.5 text-slate-400" />
        <span className="text-sm text-slate-500">Requests</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="flex size-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
            <ClipboardList className="size-4" />
          </div>
          <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-white">
            3
          </span>
        </div>
        <div className="flex size-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white">
          OK
        </div>
      </div>
    </div>
  );
}

/** Scales its children down (never up) so they fit the parent's height. */
function FitToHeight({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    function measure() {
      const outer = outerRef.current;
      const inner = innerRef.current;
      if (!outer || !inner) return;
      const availableH = outer.offsetHeight;
      const contentH = inner.scrollHeight;
      if (contentH <= 0 || availableH <= 0) return;
      setScale(Math.min(1, availableH / contentH));
    }

    measure();
    const ro = new ResizeObserver(measure);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="h-full w-full overflow-hidden">
      <div
        ref={innerRef}
        className="w-full origin-top-center"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top center",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Wrapper that renders children at a fixed internal width, then CSS-scales to fit the container. */
function ScaledMockup({
  children,
  internalWidth = 960,
  maxViewportHeightOffset,
  className,
}: {
  children: ReactNode;
  internalWidth?: number;
  maxViewportHeightOffset?: number;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    function measure() {
      if (!containerRef.current || !innerRef.current) return;
      const containerW = containerRef.current.offsetWidth;
      const contentHeight = innerRef.current.scrollHeight || innerRef.current.offsetHeight;
      let s = Math.min(1, containerW / internalWidth);

      if (maxViewportHeightOffset !== undefined && contentHeight > 0) {
        const viewportHeight = Math.max(240, window.innerHeight - maxViewportHeightOffset);
        s = Math.min(s, viewportHeight / contentHeight);
      }

      setScale(s);
      setHeight(contentHeight * s);
    }

    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [internalWidth, maxViewportHeightOffset]);

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full min-w-0 overflow-hidden", className)}
      style={{ height }}
    >
      <div
        ref={innerRef}
        style={{
          width: internalWidth,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function HeroMockupContent() {
  return (
    <div className="gk-v2 force-light overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xl shadow-black/10">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3 py-1.5">
        <span className="size-2.5 rounded-full bg-[#FF5F57]" />
        <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="size-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 flex-1 rounded-md border border-slate-200 bg-white/80 px-3 py-0.5 text-center text-[11px] text-slate-400">
          okrunit.com/requests
        </span>
      </div>

      {/* App shell — no sidebar to keep it compact */}
      <div className="flex min-w-0 flex-1 flex-col">
        <HeroTopBar />
        <div className="bg-slate-50/50 p-3 sm:p-4">
          {/* Stat cards */}
          <div className="mb-3 grid grid-cols-3 gap-1.5 sm:mb-4 sm:gap-2">
            {heroMetrics.map((metric) => (
              <MetricCard key={metric.title} metric={metric} className="max-w-none" />
            ))}
          </div>

          {/* Needs attention */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">Needs Your Attention</span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                  {queueAttention.length}
                </span>
              </div>
              <span className="text-xs text-slate-500">View all →</span>
            </div>
            <div className="space-y-1.5">
              {queueAttention.slice(0, 3).map((item) => (
                <AppRequestCard key={`${item.title}-${item.age}`} item={item} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroProductSystem() {
  return (
    <ScaledMockup
      internalWidth={640}
      maxViewportHeightOffset={320}
      className="mx-auto w-full max-w-[640px] overflow-hidden"
    >
      <HeroMockupContent />
    </ScaledMockup>
  );
}

interface FeatureStep {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  visual: ReactNode;
}

function ScrollFeatures({ steps }: { steps: FeatureStep[] }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onScroll() {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const containerTop = -rect.top;
      const scrollableHeight = el.offsetHeight - window.innerHeight;
      if (scrollableHeight <= 0) return;
      const progress = Math.max(0, Math.min(1, containerTop / scrollableHeight));
      const idx = Math.min(
        steps.length - 1,
        Math.floor(progress * steps.length),
      );
      setActiveIndex(idx);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [steps.length]);

  return (
    <section className="relative">
      {/* Mobile: stacked sections, no scroll-lock */}
      <div className="lg:hidden">
        <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:space-y-16 sm:px-6 sm:py-16">
          {steps.map((step) => (
            <div key={step.id} id={step.id}>
              <div className="space-y-3 sm:space-y-4">
                <SectionEyebrow>{step.eyebrow}</SectionEyebrow>
                <h2 className="text-xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.18)] sm:text-2xl md:text-3xl">
                  {step.title}
                </h2>
                <p className="text-sm leading-7 text-emerald-50/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.12)] sm:text-base sm:leading-8">
                  {step.description}
                </p>
              </div>
              <div className="mt-8">
                {step.visual}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop: centered sticky crossfade */}
      <div
        ref={containerRef}
        className="relative hidden lg:block"
        style={{ height: `${steps.length * 100}vh` }}
      >
        <div className="sticky top-0 h-screen overflow-hidden">
          {steps.map((step, i) => (
            <div
              key={step.id}
              className="absolute inset-0 flex flex-col items-center justify-center px-8 py-8 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                opacity: activeIndex === i ? 1 : 0,
                transform: activeIndex === i
                  ? "translateY(0) scale(1)"
                  : activeIndex > i
                    ? "translateY(-24px) scale(0.98)"
                    : "translateY(24px) scale(0.98)",
                pointerEvents: activeIndex === i ? "auto" : "none",
              }}
            >
              {/* Step indicator dots */}
              <div className="mb-4 flex shrink-0 items-center justify-center gap-2">
                {steps.map((_, j) => (
                  <div
                    key={j}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-500",
                      activeIndex === j
                        ? "w-8 bg-white"
                        : "w-1.5 bg-white/30",
                    )}
                  />
                ))}
              </div>

              {/* Text content — centered, compact */}
              <div className="mx-auto mb-4 max-w-2xl shrink-0 text-center">
                <SectionEyebrow>{step.eyebrow}</SectionEyebrow>
                <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.18)] md:text-3xl xl:text-[2.25rem]">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-emerald-50/92 drop-shadow-[0_1px_8px_rgba(0,0,0,0.12)] sm:text-base sm:leading-7">
                  {step.description}
                </p>
              </div>

              {/* Visual — constrained to max 55vh so it never pushes content off screen */}
              <div className="w-full max-w-4xl shrink-0" style={{ maxHeight: "55vh" }}>
                <FitToHeight>{step.visual}</FitToHeight>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function LandingPage({ user }: LandingPageProps) {
  return (
    <div className="gk-v2 force-light min-h-screen overflow-x-clip font-[var(--font-dm-sans)] text-[var(--foreground)]">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:gap-6 sm:py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/logo-icon.png"
              alt="OKrunit"
              width={36}
              height={36}
              className="size-8 object-contain sm:size-9"
              priority
            />
            <span className="text-lg font-bold tracking-tight text-slate-900">OKrunit</span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 lg:flex">
            <Link href="/docs" className="transition-colors hover:text-slate-950">
              Docs
            </Link>
            <Link href="/docs/integrations" className="transition-colors hover:text-slate-950">
              Integrations
            </Link>
            <Link href="/docs/api" className="transition-colors hover:text-slate-950">
              API
            </Link>
            <Link href="/docs/changelog" className="transition-colors hover:text-slate-950">
              Changelog
            </Link>
          </nav>

          <div className="hidden lg:block">
            <HeroNav user={user} />
          </div>

          {/* Mobile: auth buttons + hamburger */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden">
            {user ? (
              <Button size="sm" className="h-8 rounded-lg bg-[#2e7d32] px-3 text-xs text-white hover:bg-[#1b5e20]" asChild>
                <a href="/org/overview">Dashboard</a>
              </Button>
            ) : (
              <>
                <Button variant="outline" size="sm" className="hidden h-8 rounded-lg border-slate-200 bg-white px-2.5 text-xs text-slate-700 hover:bg-slate-50 min-[360px]:flex" asChild>
                  <Link href="/login">Log in</Link>
                </Button>
                <Button size="sm" className="h-8 rounded-lg bg-[#2e7d32] px-3 text-xs text-white hover:bg-[#1b5e20]" asChild>
                  <Link href="/signup">Sign up</Link>
                </Button>
              </>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="size-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                  <Menu className="size-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="gk-v2 force-light w-72 bg-white p-0">
                <div className="flex flex-col gap-1 px-4 pt-12 pb-6">
                  <Link href="/docs" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Docs
                  </Link>
                  <Link href="/docs/integrations" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Integrations
                  </Link>
                  <Link href="/docs/api" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    API
                  </Link>
                  <Link href="/docs/changelog" className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Changelog
                  </Link>
                </div>
                <div className="border-t border-slate-100 px-4 py-4">
                  <div className="flex flex-col gap-2">
                    {user ? (
                      <Button className="w-full bg-[#2e7d32] text-white hover:bg-[#1b5e20]" asChild>
                        <a href="/org/overview">Go to Dashboard</a>
                      </Button>
                    ) : (
                      <>
                        <Button className="w-full bg-[#2e7d32] text-white hover:bg-[#1b5e20]" asChild>
                          <Link href="/signup">Sign up</Link>
                        </Button>
                        <Button variant="outline" className="w-full border-slate-200 bg-white text-slate-700 hover:bg-slate-50" asChild>
                          <Link href="/login">Log in</Link>
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main>
        <section id="hero" className="relative bg-[linear-gradient(180deg,#e8f5e9_0%,#c8e6c9_25%,#81c784_55%,#2e7d32_85%,#1b5e20_100%)]">
          <div className="mx-auto flex max-w-7xl flex-col px-4 pb-6 pt-6 sm:px-6 sm:pb-8 sm:pt-10 lg:min-h-[calc(100svh-69px)] lg:px-8 lg:pb-6 lg:pt-6 xl:pb-12 xl:pt-12">
            <div className="grid gap-6 sm:gap-8 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center lg:gap-6 xl:gap-10">
              <FadeIn className="min-w-0">
                <div className="min-w-0 max-w-xl space-y-5 sm:space-y-6 lg:max-w-[31rem] xl:max-w-xl">
                  <SectionEyebrow>Human-in-the-Loop Approvals</SectionEyebrow>
                  <div className="space-y-4 sm:space-y-5">
                    <h1 className="text-[1.75rem] font-semibold leading-[1.2] tracking-tight text-slate-900 sm:text-4xl md:text-5xl lg:text-[3rem] lg:leading-[1.12] xl:text-[3.25rem] xl:leading-[1.15]">
                      The approval gateway for your automations and AI&nbsp;agents.
                    </h1>
                    <p className="text-base leading-7 text-slate-700 sm:text-lg sm:leading-8 lg:text-[1.0625rem] lg:leading-7 xl:text-lg xl:leading-8">
                      Route high-risk actions from Zapier, Make, n8n, GitHub Actions, and any API
                      through a human approval queue before they execute. One dashboard for every
                      workflow that needs a second pair of eyes.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button size="lg" className="h-11 rounded-2xl px-5 text-sm sm:h-12 sm:px-6" asChild>
                      <Link href={user ? "/org/overview" : "/signup"}>
                        {user ? "Go to Dashboard" : "Start Free"}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-11 rounded-2xl border-slate-200 !bg-white px-5 text-sm text-slate-900 sm:h-12 sm:px-6"
                      asChild
                    >
                      <Link href="/docs">
                        View Docs
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>

                </div>
              </FadeIn>

              <FadeIn delay={120} className="min-w-0 w-full">
                <div className="min-w-0">
                  <HeroProductSystem />
                </div>
              </FadeIn>
            </div>

            {/* Integration marquee — full width below hero grid */}
            <FadeIn delay={200}>
              <div className="mt-10 space-y-4 sm:mt-12 lg:mt-6 xl:mt-12">
                <p className="text-center text-sm font-medium text-white/85">
                  Works with your existing tools
                </p>
                <IntegrationMarquee />
              </div>
            </FadeIn>
          </div>
        </section>

        {/* Dark scrollytelling feature section */}
        <div className="relative bg-[#1b5e20]">
          <ScrollFeatures
            steps={[
              {
                id: "approvals",
                eyebrow: "Approval Flow",
                title: "Click a request, review the full context, and decide — all in one view.",
                description: "Each request card shows its source, priority, and status at a glance. Click to open the detail panel with the full metadata grid, approval chain progress, and approve or reject actions.",
                visual: <ApprovalFlowVisual />,
              },
              {
                id: "queue",
                eyebrow: "Queue System",
                title: "Pending requests surface first. Resolved history stays accessible below.",
                description: "The queue separates what needs attention right now from what’s already been decided. Source markers, action types, timestamps, and status badges let operators scan without opening every row.",
                visual: (
                  <div className="gk-v2 force-light relative overflow-hidden rounded-xl bg-white p-1 shadow-2xl shadow-black/20">
                    <QueuePanel
                      attentionItems={queueAttention}
                      resolvedItems={queueResolved}
                      title="Approval Queue"
                      description="Grouped rows, visible status chips, and enough metadata to make the next decision without guessing."
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-xl bg-gradient-to-t from-white to-transparent" />
                  </div>
                ),
              },
              {
                id: "routing",
                eyebrow: "Routing & Notifications",
                title: "Define who approves and which channels get notified — per source.",
                description: "Approval flows carry source ownership, request counts, and last activity. Messaging channels show exactly which sources notify them so route behavior is always visible.",
                visual: (
                  <div className="gk-v2 force-light overflow-hidden rounded-xl bg-white p-3 shadow-2xl shadow-black/20 sm:p-4">
                    <RoutingSystemPanel />
                  </div>
                ),
              },
              {
                id: "audit",
                eyebrow: "Audit Trail",
                title: "Every decision, rule change, and route update in one searchable history.",
                description: "Approval decisions, flow edits, and route changes appear together with actor, timestamp, resource, and expanded detail payloads. Built for compliance and debugging.",
                visual: <MobileAuditVisual />,
              },
            ]}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-64 bg-gradient-to-b from-transparent via-[#1b5e20] to-[#1b5e20] lg:block"
          />
        </div>

        <section className="bg-[linear-gradient(180deg,#1b5e20_0%,#2e7d32_12%,#81c784_42%,#c8e6c9_74%,#e8f5e9_100%)] py-12 sm:py-20 lg:py-[4.5rem]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <FadeIn>
              <div className="mx-auto max-w-2xl text-center">
                <SectionEyebrow>Get Started</SectionEyebrow>
                <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl md:text-3xl">
                  Start approving in minutes, not days.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-700 sm:text-base sm:leading-7">
                  Create a workspace, connect your first source, and send a test
                  approval request. Your team can be reviewing live actions today.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-3 sm:mt-8 sm:flex-row">
                  <Button size="lg" className="h-11 rounded-2xl px-5 text-sm sm:h-12 sm:px-6" asChild>
                    <Link href={user ? "/org/overview" : "/signup"}>
                      {user ? "Open Dashboard" : "Create Free Workspace"}
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-11 rounded-2xl border-slate-300 !bg-white px-5 text-sm text-slate-900 hover:!bg-slate-50 sm:h-12 sm:px-6"
                    asChild
                  >
                    <Link href="/docs">
                      Read the Docs
                      <ArrowRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            </FadeIn>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
