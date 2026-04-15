import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { RequestsNav } from "@/components/requests/requests-nav";
import { TourHint } from "@/components/onboarding/tour-hint";

export default async function RequestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  const isAdmin = membership.role === "owner" || membership.role === "admin";

  return (
    <div className="flex w-full flex-col md:h-[calc(100vh-52px)] md:flex-row md:overflow-hidden">
      {/* Left sidebar - desktop */}
      <aside className="hidden md:block w-56 shrink-0 border-r border-border/40 bg-[var(--card)] pt-5 overflow-y-auto">
        <RequestsNav isAdmin={isAdmin} pendingCount={0} />
      </aside>

      {/* Mobile nav - top dropdown */}
      <div className="md:hidden border-b border-border/40 bg-background px-4 py-3">
        <RequestsNav isAdmin={isAdmin} pendingCount={0} mobile />
      </div>

      {/* Main content - sole scroll container */}
      <div className="relative flex-1 min-w-0 overflow-y-auto">
        <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <TourHint />
          {children}
        </div>
      </div>
    </div>
  );
}
