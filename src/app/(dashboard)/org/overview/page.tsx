import { redirect } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getOrgContext } from "@/lib/org-context";
import { getCachedOverviewData } from "@/lib/cache/queries";
import { JoinedToast } from "@/components/org/joined-toast";

import { OnboardingTutorial } from "@/components/onboarding/onboarding-tutorial";
import { RecentActivity } from "@/components/overview/recent-activity";
import {
  AlertTriangle,
  Hourglass,
  ShieldCheck,
  Unplug,
  UsersRound,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import type { ApprovalRequest } from "@/lib/types/database";

export const metadata = {
  title: "Overview - OKrunit",
  description: "Organization overview and quick actions.",
};

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


  return (
    <div className="space-y-8">
      <Suspense><JoinedToast /></Suspense>
      {/* Alert banners */}
      {slaBreachedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">{slaBreachedCount} pending request{slaBreachedCount !== 1 ? "s have" : " has"} breached SLA deadlines.</span>
          <Link href="/requests" className="ml-auto text-xs font-medium underline">View</Link>
        </div>
      )}
      {escalatedCount > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">{escalatedCount} request{escalatedCount !== 1 ? "s are" : " is"} currently escalated.</span>
          <Link href="/requests" className="ml-auto text-xs font-medium underline">View</Link>
        </div>
      )}

      {/* Onboarding tutorial - shown until dismissed */}
      <OnboardingTutorial />

      {/* Org header - only on overview */}
      <div data-tour="overview-main" className="space-y-8">
        <div>
          <p className="text-xs font-medium text-primary mb-0.5">Organization</p>
          <h1 className="text-xl font-semibold tracking-tight">{org.name}</h1>
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
