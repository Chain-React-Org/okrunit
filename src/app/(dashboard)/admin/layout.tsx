import { redirect } from "next/navigation";
import { getAppAdminContext } from "@/lib/app-admin";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getAppAdminContext();
  if (!profile) redirect("/org/overview");

  return (
    <div className="flex w-full flex-col md:flex-row md:min-h-[calc(100vh-52px)]">
      {/* Left sidebar - desktop */}
      <aside className="hidden md:block w-56 shrink-0 border-r border-border/40 bg-[var(--card)]">
        <div className="sticky top-0 pt-5">
          <AdminNav />
        </div>
      </aside>

      {/* Mobile nav - top dropdown */}
      <div className="md:hidden border-b border-border/40 bg-background px-4 py-3">
        <AdminNav mobile />
      </div>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <div className="px-6 lg:px-8 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}
