import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getOrgContext } from "@/lib/org-context";
import { getCachedDashboardData, getCachedOrgLayoutData } from "@/lib/cache/queries";
import { createClient } from "@/lib/supabase/server";

function DashboardLoading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent>{children}</DashboardContent>
    </Suspense>
  );
}

async function DashboardContent({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  const ctx = await getOrgContext();

  if (!ctx) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      redirect("/login?error=no_org");
    }

    redirect("/login");
  }

  const { profile, membership, org } = ctx;

  // Force users who haven't completed setup through the wizard.
  // Allow access to /setup itself to avoid a redirect loop.
  if (!profile.setup_completed_at) {
    const headerList = await headers();
    const pathname = headerList.get("x-pathname") || "";
    if (!pathname.startsWith("/setup")) {
      redirect("/setup");
    }
  }

  const [{ userOrgs, pendingCount }, { currentPlan }] = await Promise.all([
    getCachedDashboardData(profile.id, org.id),
    getCachedOrgLayoutData(org.id),
  ]);

  return (
    <DashboardShell
      currentPlan={currentPlan}
      sidebarProps={{
        user: {
          id: profile.id,
          email: profile.email,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
        },
        currentOrgId: org.id,
        userOrgs,
        pendingCount,
        userRole: membership.role,
        isAppAdmin: profile.is_app_admin,
      }}
      emergencyStopActive={org.emergency_stop_active}
      user={{
        email: profile.email,
        full_name: profile.full_name,
      }}
      orgName={org.name}
      pendingCount={pendingCount}
      currentOrgId={org.id}
      userOrgs={userOrgs}
      userId={profile.id}
    >
      {children}
    </DashboardShell>
  );
}
