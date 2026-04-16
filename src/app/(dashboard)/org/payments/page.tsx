import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExternalLink } from "lucide-react";

export const metadata = {
  title: "Payments - OKrunit",
  description: "View your payment history and invoices.",
};

export default async function OrgPaymentsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { org, membership } = ctx;

  const admin = createAdminClient();

  const { data: invoices } = await admin
    .from("invoices")
    .select("*")
    .eq("org_id", org.id)
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Payments</h2>
        <p className="text-sm text-muted-foreground mt-0.5">View your payment history and invoices.</p>
      </div>

      <div className="rounded-xl border border-border/50 bg-[var(--card)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-left">
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground text-right">Amount</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground text-right">Invoice</th>
            </tr>
          </thead>
          <tbody>
            {invoices && invoices.length > 0 ? (
              invoices.map((invoice: Record<string, unknown>) => {
                const status = invoice.status as string;
                const hostedUrl = invoice.hosted_invoice_url as string | null;
                return (
                  <tr key={invoice.id as string} className="border-b border-border/30 last:border-0">
                    <td className="px-5 py-3.5 font-medium">
                      {new Date(invoice.created_at as string).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        status === "paid"
                          ? "bg-emerald-100 text-emerald-800"
                          : status === "open"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-zinc-100 text-zinc-600"
                      }`}>
                        {status === "paid" ? "Paid" : status.charAt(0).toUpperCase() + status.slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">
                      ${((invoice.amount_cents as number ?? 0) / 100).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {hostedUrl && (
                        <a
                          href={hostedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
                        >
                          View
                          <ExternalLink className="size-3" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-sm text-muted-foreground">
                  No payments yet. Your payment history will appear here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
