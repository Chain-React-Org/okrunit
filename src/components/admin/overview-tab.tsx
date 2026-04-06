"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Admin Overview Tab
// System-wide stats cards with visual indicators.
// ---------------------------------------------------------------------------

import {
  Building2,
  Users,
  Clock,
  Key,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Activity,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { SystemStats, OrgWithCounts } from "@/lib/admin-types";

interface OverviewTabProps {
  stats: SystemStats;
  organizations: OrgWithCounts[];
}

// -- Approval Rate Ring SVG --------------------------------------------------

function ApprovalRateRing({ rate }: { rate: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const filled = (rate / 100) * circumference;
  const color = rate >= 80 ? "text-emerald-500" : rate >= 50 ? "text-amber-500" : "text-red-500";

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - filled}
          strokeLinecap="round"
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold">{rate}%</span>
      </div>
    </div>
  );
}

// -- Component ---------------------------------------------------------------

export function OverviewTab({ stats, organizations }: OverviewTabProps) {
  const decided = stats.approved_count + stats.rejected_count;
  const approvalRate =
    decided > 0
      ? Math.round((stats.approved_count / decided) * 10000) / 100
      : 0;

  // Top organizations by approval volume for the chart
  const topOrgs = [...organizations]
    .sort((a, b) => b.approval_count - a.approval_count)
    .slice(0, 8);

  const barColors = [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ];

  return (
    <div className="space-y-6 pt-4">
      {/* Primary Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Organizations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Organizations
            </CardTitle>
            <div className="rounded-md bg-blue-50 p-1.5">
              <Building2 className="size-4 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{stats.total_orgs}</div>
            {stats.emergency_stops_active > 0 ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                <AlertTriangle className="size-3" />
                {stats.emergency_stops_active} emergency stop{stats.emergency_stops_active !== 1 ? "s" : ""} active
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">All systems normal</p>
            )}
          </CardContent>
        </Card>

        {/* Users */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
            <div className="rounded-md bg-violet-50 p-1.5">
              <Users className="size-4 text-violet-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">{stats.total_users}</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Across {stats.total_orgs} organization{stats.total_orgs !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        {/* Active Connections */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Connections
            </CardTitle>
            <div className="rounded-md bg-emerald-50 p-1.5">
              <Key className="size-4 text-emerald-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {stats.active_connections}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              API keys &amp; integrations
            </p>
          </CardContent>
        </Card>

        {/* Pending */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Approvals
            </CardTitle>
            <div className="rounded-md bg-amber-50 p-1.5">
              <Clock className="size-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold tracking-tight">
              {stats.pending_approvals}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Awaiting decision
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Second Row: Approval Rate + Decision Breakdown + Top Orgs Chart */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Approval Rate Ring */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Approval Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <ApprovalRateRing rate={approvalRate} />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-emerald-500" />
                  <span className="text-sm text-muted-foreground">
                    {stats.approved_count} approved
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-red-500" />
                  <span className="text-sm text-muted-foreground">
                    {stats.rejected_count} rejected
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-amber-500" />
                  <span className="text-sm text-muted-foreground">
                    {stats.pending_approvals} pending
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Decision Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Decision Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="size-4 text-emerald-500" />
                  <span className="text-sm font-medium">Approved</span>
                </div>
                <span className="text-2xl font-bold text-emerald-600">
                  {stats.approved_count}
                </span>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="size-4 text-red-500" />
                  <span className="text-sm font-medium">Rejected</span>
                </div>
                <span className="text-2xl font-bold text-red-600">
                  {stats.rejected_count}
                </span>
              </div>

              <div className="h-px bg-border" />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Total Processed</span>
                </div>
                <span className="text-2xl font-bold">
                  {stats.total_approvals}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-sm">Emergency Stops</span>
                {stats.emergency_stops_active > 0 ? (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-red-600">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                    </span>
                    {stats.emergency_stops_active} active
                  </span>
                ) : (
                  <span className="text-sm font-medium text-emerald-600">None</span>
                )}
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-sm">Organizations</span>
                <span className="text-sm font-medium">{stats.total_orgs} registered</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-sm">Connections</span>
                <span className="text-sm font-medium">{stats.active_connections} active</span>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-sm">Pending Queue</span>
                <span className={`text-sm font-medium ${stats.pending_approvals > 10 ? "text-amber-600" : ""}`}>
                  {stats.pending_approvals} items
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Organization Volume Chart */}
      {topOrgs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Approvals by Organization</CardTitle>
            <CardDescription>
              Top organizations ranked by total approval request volume
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topOrgs.map((org, idx) => {
                const maxCount = topOrgs[0].approval_count || 1;
                const pct = (org.approval_count / maxCount) * 100;
                const name = org.name.length > 30 ? org.name.slice(0, 28) + "..." : org.name;
                return (
                  <Tooltip key={org.id}>
                    <TooltipTrigger asChild>
                      <div className="group cursor-default">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm truncate max-w-[70%]">{name}</span>
                          <span className="text-sm font-medium tabular-nums">{org.approval_count}</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-muted/50">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.max(pct, 2)}%`,
                              backgroundColor: barColors[idx % barColors.length],
                            }}
                          />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      {org.name}: {org.approval_count} approval{org.approval_count !== 1 ? "s" : ""}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
