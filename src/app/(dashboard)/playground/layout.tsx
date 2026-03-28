import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { PlaygroundNav } from "@/components/playground/playground-nav";

export default async function PlaygroundLayout({
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
      <aside className="hidden md:block w-56 shrink-0 border-r border-border/40 bg-white pt-0">
        <PlaygroundNav isAdmin={isAdmin} />
      </aside>

      {/* Mobile nav — top dropdown */}
      <div className="md:hidden border-b border-border/40 bg-background px-4 py-3">
        <PlaygroundNav isAdmin={isAdmin} mobile />
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
