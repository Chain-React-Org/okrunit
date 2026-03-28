import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { SettingsNav } from "@/components/settings/settings-nav";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");

  const isAdmin = ctx.membership.role === "owner" || ctx.membership.role === "admin";

  return (
    <div className="flex w-full flex-col md:min-h-[calc(100vh-52px)] md:flex-row">
      <aside className="hidden w-56 shrink-0 border-r border-border/40 bg-white md:block">
        <SettingsNav isAdmin={isAdmin} />
      </aside>

      <div className="border-b border-border/40 bg-background px-4 py-3 md:hidden">
        <SettingsNav isAdmin={isAdmin} mobile />
      </div>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
