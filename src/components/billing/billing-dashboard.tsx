"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ExternalLink, CreditCard, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS, isUnlimited, PLAN_ORDER } from "@/lib/billing/plans";
import type { Plan, Subscription, Invoice, BillingPlan } from "@/lib/types/database";
import { toast } from "sonner";

interface BillingDashboardProps {
  plans: Plan[];
  subscription: Subscription | null;
  usage: {
    requests: number;
    connections: number;
    teamMembers: number;
  };
  invoices: Invoice[];
  isAdmin: boolean;
  orgId: string;
}

export function BillingDashboard({ plans, subscription, usage, invoices, isAdmin, orgId }: BillingDashboardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const currentPlan = (subscription?.plan_id ?? "free") as BillingPlan;
  const limits = PLAN_LIMITS[currentPlan];

  const handleCheckout = async (planId: string) => {
    if (!isAdmin) { toast.error("Only admins can manage billing"); return; }
    setLoading(planId);
    try {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.error(data.error ?? "Failed to start checkout");
    } catch { toast.error("Failed to start checkout"); }
    finally { setLoading(null); }
  };

  const handlePortal = async () => {
    if (!isAdmin) { toast.error("Only admins can manage billing"); return; }
    setLoading("portal");
    try {
      const res = await fetch("/api/v1/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else toast.error(data.error ?? "Failed to open billing portal");
    } catch { toast.error("Failed to open billing portal"); }
    finally { setLoading(null); }
  };

  const requestsPct = isUnlimited(limits.maxRequests) ? 0 : Math.round((usage.requests / limits.maxRequests) * 100);
  const requestsLabel = isUnlimited(limits.maxRequests)
    ? `${usage.requests} used`
    : `${usage.requests} / ${limits.maxRequests} used (${requestsPct}%)`;

  return (
    <div className="space-y-10">
      {/* ── My Plan Section (like Make.com) ── */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Subscription</h3>
        <div className="divide-y rounded-lg border">
          {/* Row: My plan */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-24">My plan</span>
              <Badge variant={currentPlan === "free" ? "secondary" : "default"} className="text-xs">
                {limits.name}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {isUnlimited(limits.maxRequests) ? "Unlimited" : `${limits.maxRequests}`} requests/month
              </span>
            </div>
            {isAdmin && (
              <Button variant="outline" size="sm" className="text-xs gap-1.5" asChild>
                <a href="#plans"><Gift className="size-3.5" /> Compare plans</a>
              </Button>
            )}
          </div>

          {/* Row: Billing */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-24">Billing</span>
              <span className="text-sm">
                {limits.priceMonthly === 0 ? "$0.00" : `$${limits.priceMonthly}.00`} billed {subscription?.billing_cycle ?? "monthly"}
              </span>
            </div>
            {isAdmin && subscription?.stripe_customer_id && (
              <Button variant="outline" size="sm" onClick={handlePortal} disabled={loading === "portal"} className="text-xs gap-1.5">
                <CreditCard className="size-3.5" />
                {loading === "portal" ? "Opening..." : "Manage billing"}
              </Button>
            )}
            {isAdmin && !subscription?.stripe_customer_id && currentPlan !== "free" && (
              <Button variant="outline" size="sm" className="text-xs">Add payment method</Button>
            )}
          </div>

          {/* Row: Usage */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3 flex-1">
              <span className="text-sm font-medium text-muted-foreground w-24">Requests</span>
              <div className="flex items-center gap-3 flex-1 max-w-md">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm">{requestsLabel}</span>
                  </div>
                  {!isUnlimited(limits.maxRequests) && (
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          requestsPct >= 80 ? "bg-amber-500" : "bg-primary",
                        )}
                        style={{ width: `${Math.min(100, requestsPct)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row: Connections */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-24">Connections</span>
              <span className="text-sm">
                {usage.connections} / {isUnlimited(limits.maxConnections) ? "Unlimited" : limits.maxConnections} active
              </span>
            </div>
          </div>

          {/* Row: Team */}
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground w-24">Team</span>
              <span className="text-sm">
                {usage.teamMembers} / {isUnlimited(limits.maxTeamMembers) ? "Unlimited" : limits.maxTeamMembers} members
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Compare Plans (like Make.com) ── */}
      <div id="plans">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Compare Plans</h3>
          <div className="flex items-center gap-3 text-sm">
            <span className={cn("font-medium", billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground")}>
              Billed monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === "monthly" ? "yearly" : "monthly")}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                billingCycle === "yearly" ? "bg-primary" : "bg-muted",
              )}
            >
              <span className={cn(
                "inline-block size-4 rounded-full bg-white transition-transform shadow-sm",
                billingCycle === "yearly" ? "translate-x-6" : "translate-x-1",
              )} />
            </button>
            <span className={cn("font-medium", billingCycle === "yearly" ? "text-foreground" : "text-muted-foreground")}>
              Billed yearly{" "}
              <span className="text-primary font-semibold">(Save 15% or more)</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((planId) => {
            const plan = PLAN_LIMITS[planId];
            const isCurrent = planId === currentPlan;
            const currentIdx = PLAN_ORDER.indexOf(currentPlan);
            const planIdx = PLAN_ORDER.indexOf(planId);
            const isUpgrade = planIdx > currentIdx;
            const isEnterprise = planId === "enterprise";
            const displayPrice = billingCycle === "yearly" ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;

            return (
              <Card key={planId} className={cn(
                "relative",
                isCurrent && "border-primary ring-1 ring-primary/20",
                isEnterprise && "bg-foreground text-white",
              )}>
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-xs">Your plan</Badge>
                  </div>
                )}
                <CardContent className="pt-6">
                  {/* Price area — fixed height */}
                  <div className="mb-5 h-[100px]">
                    <h4 className="text-base font-bold">{plan.name}</h4>
                    <p className="mt-1">
                      <span className="text-3xl font-bold">
                        {displayPrice === 0 && !isEnterprise ? "$0" : isEnterprise ? "" : `$${displayPrice}`}
                      </span>
                      {displayPrice > 0 && (
                        <span className={cn("text-sm", isEnterprise ? "text-white/60" : "text-muted-foreground")}>.00 /mo</span>
                      )}
                      {isEnterprise && <span className="text-xl font-bold">Custom</span>}
                    </p>
                    <p className={cn("mt-0.5 text-xs", isEnterprise ? "text-white/60" : "text-muted-foreground")}>
                      {displayPrice === 0 && !isEnterprise
                        ? "Free forever"
                        : billingCycle === "yearly" && plan.priceYearly > 0
                          ? "Billed yearly"
                          : isEnterprise
                            ? "\u00A0"
                            : "Billed monthly"}
                    </p>
                    {billingCycle === "yearly" && plan.priceYearly > 0 && (
                      <p className={cn("text-xs", isEnterprise ? "text-white/60" : "text-muted-foreground")}>
                        Annual package of credits
                      </p>
                    )}
                  </div>

                  {/* CTA button */}
                  <div className="mb-5">
                    {isAdmin && isUpgrade && !isEnterprise && (
                      <Button
                        className="w-full"
                        variant={isEnterprise ? "outline" : "default"}
                        onClick={() => handleCheckout(planId)}
                        disabled={loading === planId}
                      >
                        {loading === planId ? "Loading..." : `Buy ${billingCycle} plan`}
                      </Button>
                    )}
                    {isEnterprise && isUpgrade && (
                      <Button variant="outline" className="w-full border-white/30 text-white hover:bg-white/10" asChild>
                        <a href="mailto:support@okrunit.com">Talk to sales</a>
                      </Button>
                    )}
                    {isCurrent && (
                      <p className={cn("text-center text-xs", isEnterprise ? "text-white/60" : "text-muted-foreground")}>
                        Your current plan
                      </p>
                    )}
                    {!isCurrent && !isUpgrade && !isEnterprise && (
                      <p className="text-center text-xs text-muted-foreground">&nbsp;</p>
                    )}
                  </div>

                  {/* Features */}
                  <div className={cn("border-t pt-4", isEnterprise ? "border-white/20" : "")}>
                    <p className={cn("mb-3 text-xs font-semibold uppercase tracking-wider", isEnterprise ? "text-white/60" : "text-muted-foreground")}>
                      {planIdx === 0 ? `${plan.name} plan features` : `Additionally to ${PLAN_ORDER[planIdx - 1]?.toUpperCase()}`}
                    </p>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <Check className={cn("size-4 shrink-0 mt-0.5", isEnterprise ? "text-white/80" : "text-primary")} />
                        {isUnlimited(plan.maxRequests) ? "Unlimited" : plan.maxRequests} requests/mo
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className={cn("size-4 shrink-0 mt-0.5", isEnterprise ? "text-white/80" : "text-primary")} />
                        {isUnlimited(plan.maxConnections) ? "Unlimited" : plan.maxConnections} connections
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className={cn("size-4 shrink-0 mt-0.5", isEnterprise ? "text-white/80" : "text-primary")} />
                        {isUnlimited(plan.maxTeamMembers) ? "Unlimited" : plan.maxTeamMembers} team members
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className={cn("size-4 shrink-0 mt-0.5", isEnterprise ? "text-white/80" : "text-primary")} />
                        {isUnlimited(plan.historyDays) ? "Unlimited" : `${plan.historyDays}-day`} history
                      </li>
                      {plan.features.filter(f => {
                        // Show features unique to this tier
                        const prevPlan = planIdx > 0 ? PLAN_LIMITS[PLAN_ORDER[planIdx - 1]] : null;
                        return !prevPlan || !prevPlan.features.includes(f);
                      }).slice(0, 4).map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className={cn("size-4 shrink-0 mt-0.5", isEnterprise ? "text-white/80" : "text-primary")} />
                          {f.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Comparison Table (like Make.com) ── */}
      <div>
        <h3 className="mb-5 text-lg font-semibold">Comparison table</h3>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-5 py-3 text-left font-normal text-muted-foreground w-[240px]" />
                {PLAN_ORDER.map((planId) => {
                  const isCurrent = planId === currentPlan;
                  return (
                    <th key={planId} className={cn("px-4 py-3 text-center font-semibold", isCurrent && "bg-primary/5")}>
                      {isCurrent && <span className="block text-xs font-medium text-primary mb-0.5">Your plan</span>}
                      {PLAN_LIMITS[planId].name}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                { label: "Requests per month", key: "maxRequests" },
                { label: "Connections", key: "maxConnections" },
                { label: "Team members", key: "maxTeamMembers" },
                { label: "History retention", key: "historyDays" },
                { label: "Email notifications", feature: "email_notifications" },
                { label: "Slack notifications", feature: "slack_notifications" },
                { label: "Webhook notifications", feature: "webhook_notifications" },
                { label: "Rules engine", feature: "rules_engine" },
                { label: "Analytics", feature: "analytics" },
                { label: "Analytics export", feature: "analytics_export" },
                { label: "SSO / SAML", feature: "sso_saml" },
                { label: "Audit log export", feature: "audit_log_export" },
                { label: "Multi-step approvals", feature: "multi_step_approvals" },
                { label: "Custom routing", feature: "custom_routing" },
                { label: "Dedicated support", feature: "dedicated_support" },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground">{row.label}</td>
                  {PLAN_ORDER.map((planId) => {
                    const plan = PLAN_LIMITS[planId];
                    const isCurrent = planId === currentPlan;
                    let value: string | React.ReactNode = "—";

                    if (row.key === "maxRequests") {
                      value = isUnlimited(plan.maxRequests) ? "Unlimited" : String(plan.maxRequests);
                    } else if (row.key === "maxConnections") {
                      value = isUnlimited(plan.maxConnections) ? "Unlimited" : String(plan.maxConnections);
                    } else if (row.key === "maxTeamMembers") {
                      value = isUnlimited(plan.maxTeamMembers) ? "Unlimited" : String(plan.maxTeamMembers);
                    } else if (row.key === "historyDays") {
                      value = isUnlimited(plan.historyDays) ? "Unlimited" : `${plan.historyDays} days`;
                    } else if (row.feature) {
                      value = plan.features.includes(row.feature)
                        ? <Check className="mx-auto size-4 text-primary" />
                        : <span className="text-muted-foreground/40">—</span>;
                    }

                    return (
                      <td key={planId} className={cn("px-4 py-3 text-center", isCurrent && "bg-primary/5")}>
                        {value}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Invoice History ── */}
      {invoices.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Payments</h3>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-5 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((inv, i) => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 text-muted-foreground">{invoices.length - i}</td>
                    <td className="px-4 py-3">
                      {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-xs">
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">${(inv.amount_cents / 100).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      {inv.hosted_invoice_url && (
                        <Button variant="ghost" size="sm" asChild className="text-xs">
                          <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                            View <ExternalLink className="ml-1 size-3" />
                          </a>
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
