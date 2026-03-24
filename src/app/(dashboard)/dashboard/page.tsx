import { redirect } from "next/navigation";
import Link from "next/link";
import { getOrgContext } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageContainer } from "@/components/ui/page-container";
import { OnboardingBanner } from "@/components/onboarding/onboarding-banner";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  CheckCircle,
  Key,
  Users,
  ArrowRight,
  Plus,
  UserPlus,
  Clock,
} from "lucide-react";

export const metadata = {
  title: "Home - OKRunit",
  description: "Organization overview and quick actions.",
};

export default async function DashboardPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership, org } = ctx;

  const admin = createAdminClient();
  const supabase = await createClient();

  // Fetch stats in parallel
  const [
    { count: pendingCount },
    { count: approvedCount },
    { count: connectionCount },
    { count: memberCount },
    { data: recentActivity },
  ] = await Promise.all([
    admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "pending"),
    admin
      .from("approval_requests")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id)
      .eq("status", "approved"),
    admin
      .from("connections")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id),
    admin
      .from("org_members")
      .select("*", { count: "exact", head: true })
      .eq("org_id", org.id),
    supabase
      .from("approval_requests")
      .select("id, title, status, created_at, decided_at")
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const isAdmin = membership.role === "owner" || membership.role === "admin";

  return (
    <>
      <OnboardingBanner />
      <PageContainer>
        {/* Org header */}
        <div className="mb-8">
          <p className="text-sm font-medium text-primary">Organization</p>
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
        </div>

        {/* Stat cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pending Requests"
            value={pendingCount ?? 0}
            icon={Clock}
            iconColor="text-amber-500"
            subtitle="Awaiting decision"
          />
          <StatCard
            title="Approved"
            value={approvedCount ?? 0}
            icon={CheckCircle}
            iconColor="text-emerald-500"
            subtitle="Total approved"
          />
          <StatCard
            title="Connections"
            value={connectionCount ?? 0}
            icon={Key}
            iconColor="text-blue-500"
            subtitle="Active integrations"
          />
          <StatCard
            title="Team Members"
            value={memberCount ?? 0}
            icon={Users}
            iconColor="text-violet-500"
            subtitle="In this organization"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Recent activity */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <Button variant="ghost" size="sm" asChild className="text-xs text-primary">
                  <Link href="/requests">
                    View all requests
                    <ArrowRight className="ml-1 size-3" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {recentActivity && recentActivity.length > 0 ? (
                <div className="space-y-3">
                  {recentActivity.map((item) => (
                    <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/50 px-4 py-3">
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                        item.status === "pending" ? "bg-amber-50 text-amber-500" :
                        item.status === "approved" ? "bg-emerald-50 text-emerald-500" :
                        item.status === "rejected" ? "bg-red-50 text-red-500" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {item.status === "pending" ? <Clock className="size-4" /> :
                         item.status === "approved" ? <CheckCircle className="size-4" /> :
                         <ClipboardList className="size-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(item.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                        item.status === "pending" ? "bg-amber-50 text-amber-600" :
                        item.status === "approved" ? "bg-emerald-50 text-emerald-600" :
                        item.status === "rejected" ? "bg-red-50 text-red-600" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <ClipboardList className="mb-2 size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No requests yet</p>
                  <p className="text-xs text-muted-foreground/60">Requests will appear here when they come in</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2 text-sm" asChild>
                  <Link href="/requests">
                    <ClipboardList className="size-4 text-primary" />
                    View pending requests
                    {(pendingCount ?? 0) > 0 && (
                      <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                        {pendingCount}
                      </span>
                    )}
                  </Link>
                </Button>
                {isAdmin && (
                  <>
                    <Button variant="outline" className="w-full justify-start gap-2 text-sm" asChild>
                      <Link href="/connections">
                        <Plus className="size-4 text-primary" />
                        Create connection
                      </Link>
                    </Button>
                    <Button variant="outline" className="w-full justify-start gap-2 text-sm" asChild>
                      <Link href="/team">
                        <UserPlus className="size-4 text-primary" />
                        Invite team member
                      </Link>
                    </Button>
                  </>
                )}
                <Button variant="outline" className="w-full justify-start gap-2 text-sm" asChild>
                  <Link href="/playground">
                    <Key className="size-4 text-primary" />
                    API Playground
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </>
  );
}
