import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getOrgContext } from "@/lib/org-context";
import { getCachedOverviewData } from "@/lib/cache/queries";
import { JoinedToast } from "@/components/org/joined-toast";

import { RecentActivity } from "@/components/overview/recent-activity";
import {
  AlertTriangle,
  Hourglass,
  ShieldCheck,
  Unplug,
  UsersRound,
  ArrowUpRight,
  TrendingUp,
  Timer,
  ShieldAlert,
  BarChart3,
} from "lucide-react";
import type { ApprovalRequest } from "@/lib/types/database";

export const metadata = {
  title: "Overview - OKrunit",
  description: "Organization overview and quick actions.",
};

function formatDecisionTime(minutes: number): string {
  if (minutes < 1) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;
  return remainHours > 0 ? `${days}d ${remainHours}h` : `${days}d`;
}

function trendPercent(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return 100;
  return Math.round(((current - previous) / previous) * 100);
}

export default async function V2OrgOverviewPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { org } = ctx;

  const {
    statusCounts,
    connectionCount,
    memberCount,
    recentActivity,
    slaBreachedCount,
    escalatedCount,
    connectionNameMap,
    creatorNameMap,
    analytics,
  } = await getCachedOverviewData(org.id);

  const pendingCount = statusCounts.pending;
  const approvedCount = statusCounts.approved;
  const totalRequests = approvedCount + statusCounts.rejected + pendingCount;
  const approvalRate = totalRequests > 0 ? Math.round((approvedCount / totalRequests) * 100) : 0;

  const stats = [
    {
      label: "Pending",
      value: pendingCount,
      icon: Hourglass,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      href: "/requests",
    },
    {
      label: "Approved",
      value: approvedCount,
      icon: ShieldCheck,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      href: null,
    },
    {
      label: "Approval Rate",
      value: `${approvalRate}%`,
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      href: null,
    },
    {
      label: "Connections",
      value: connectionCount,
      icon: Unplug,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      href: "/requests/connections",
    },
    {
      label: "Members",
      value: memberCount,
      icon: UsersRound,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      href: "/org/members",
    },
  ];

  // Analytics card data (7-day window)
  const decisionTimeTrend = trendPercent(analytics.avgDecisionMinutes, analytics.prevAvgDecisionMinutes);
  const slaTrend = trendPercent(analytics.slaComplianceRate, analytics.prevSlaComplianceRate);
  const approvalRateTrend = trendPercent(analytics.approvalRate7d, analytics.prevApprovalRate7d);

  // SLA color logic
  const slaColor =
    analytics.slaComplianceRate >= 90
      ? "text-emerald-500"
      : analytics.slaComplianceRate >= 70
        ? "text-amber-500"
        : "text-red-500";
  const slaBg =
    analytics.slaComplianceRate >= 90
      ? "bg-emerald-500/10"
      : analytics.slaComplianceRate >= 70
        ? "bg-amber-500/10"
        : "bg-red-500/10";

  const analyticsCards = [
    {
      label: "Avg Decision Time",
      value: formatDecisionTime(analytics.avgDecisionMinutes),
      icon: Timer,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      trend: decisionTimeTrend,
      trendInverted: true, // lower is better
      subtitle: "Last 7 days",
    },
    {
      label: "SLA Compliance",
      value: `${analytics.slaComplianceRate}%`,
      icon: ShieldAlert,
      color: slaColor,
      bg: slaBg,
      trend: slaTrend,
      trendInverted: false,
      subtitle: "Last 7 days",
    },
    {
      label: "Pending Requests",
      value: analytics.pendingCount,
      icon: Hourglass,
      color: analytics.pendingCount > 0 ? "text-amber-500" : "text-emerald-500",
      bg: analytics.pendingCount > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
      trend: null,
      trendInverted: false,
      subtitle: null,
      href: "/requests",
    },
    {
      label: "Approval Rate (7d)",
      value: `${analytics.approvalRate7d}%`,
      icon: BarChart3,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
      trend: approvalRateTrend,
      trendInverted: false,
      subtitle: "vs previous 7 days",
    },
  ];


  return (
    <div className="space-y-8">
      <Suspense><JoinedToast /></Suspense>
      {/* Alert banners */}
      {slaBreachedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">{slaBreachedCount} pending request{slaBreachedCount !== 1 ? "s have" : " has"} breached SLA deadlines.</span>
          <Link href="/requests" className="ml-auto text-xs font-medium underline">View</Link>
        </div>
      )}
      {escalatedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">{escalatedCount} request{escalatedCount !== 1 ? "s are" : " is"} currently escalated.</span>
          <Link href="/requests" className="ml-auto text-xs font-medium underline">View</Link>
        </div>
      )}

      {/* Onboarding tutorial - shown until dismissed */}

      {/* Org header - only on overview */}
      <div data-tour="overview-main" className="space-y-8">
        <div>
          <p className="text-xs font-medium text-primary mb-0.5">Organization</p>
          <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
        </div>

        {/* Analytics cards (7-day insights) */}
        <div className="space-y-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            7-Day Insights
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {analyticsCards.map((card) => {
              const Icon = card.icon;
              // Determine if the trend is "good" based on direction
              const trendIsGood =
                card.trend !== null
                  ? card.trendInverted
                    ? card.trend <= 0
                    : card.trend >= 0
                  : null;

              const inner = (
                <div className="group relative flex h-full flex-col gap-2 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3.5 transition-colors hover:border-border">
                  <div className="flex items-center justify-between">
                    <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${card.bg}`}>
                      <Icon className={`size-4 ${card.color}`} strokeWidth={1.75} />
                    </div>
                    {card.trend !== null && (
                      <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                          trendIsGood
                            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                            : "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                        }`}
                      >
                        {card.trendInverted
                          ? card.trend <= 0
                            ? `${card.trend}%`
                            : `+${card.trend}%`
                          : card.trend >= 0
                            ? `+${card.trend}%`
                            : `${card.trend}%`}
                      </span>
                    )}
                    {"href" in card && card.href && (
                      <ArrowUpRight className="size-3.5 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight leading-none">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
                  </div>
                  {card.subtitle && (
                    <p className="text-[10px] text-muted-foreground/60">{card.subtitle}</p>
                  )}
                </div>
              );
              return "href" in card && card.href ? (
                <Link key={card.label} href={card.href}>{inner}</Link>
              ) : (
                <div key={card.label}>{inner}</div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Link
              href="/requests/analytics"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View detailed analytics
              <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const inner = (
              <div className="group relative flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3.5 transition-colors hover:border-border">
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${stat.bg}`}>
                  <Icon className={`size-5 ${stat.color}`} strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold tracking-tight leading-none">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                </div>
                {stat.href && (
                  <ArrowUpRight className="absolute right-3 top-3 size-3.5 text-muted-foreground/30 transition-colors group-hover:text-muted-foreground" />
                )}
              </div>
            );
            return stat.href ? (
              <Link key={stat.label} href={stat.href}>{inner}</Link>
            ) : (
              <div key={stat.label}>{inner}</div>
            );
          })}
        </div>

        {/* Recent activity - realtime client component */}
        <RecentActivity
          initialItems={recentActivity as unknown as ApprovalRequest[]}
          connectionNameMap={connectionNameMap}
          creatorNameMap={creatorNameMap}
          orgId={org.id}
        />
      </div>

      {/* Prefetch likely navigation targets */}
      <div className="hidden">
        <Link href="/requests" prefetch={true} />
        <Link href="/org/members" prefetch={true} />
        <Link href="/requests/connections" prefetch={true} />
        <Link href="/requests/analytics" prefetch={true} />
        <Link href="/org/teams" prefetch={true} />
        <Link href="/org/settings" prefetch={true} />
      </div>
    </div>
  );
}
