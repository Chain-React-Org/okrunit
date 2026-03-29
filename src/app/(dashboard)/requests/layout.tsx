import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { RequestsNav } from "@/components/requests/requests-nav";

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
    <div className="flex w-full flex-col md:flex-row md:min-h-[calc(100vh-52px)]">
      {/* Left sidebar — desktop */}
      <aside className="hidden md:block w-56 shrink-0 border-r border-border/40 bg-white pt-5">
        <RequestsNav isAdmin={isAdmin} pendingCount={0} />
      </aside>

      {/* Mobile nav — top dropdown */}
      <div className="md:hidden border-b border-border/40 bg-background px-4 py-3">
        <RequestsNav isAdmin={isAdmin} pendingCount={0} mobile />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
