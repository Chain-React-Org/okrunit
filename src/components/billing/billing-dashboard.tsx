"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, ExternalLink, Zap, CreditCard } from "lucide-react";
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

function UsageBar({ label, current, limit }: { label: string; current: number; limit: number }) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited ? 0 : Math.min(100, (current / limit) * 100);
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {current}{unlimited ? "" : ` / ${limit}`}
          {unlimited && <span className="ml-1 text-xs text-muted-foreground/60">(unlimited)</span>}
        </span>
      </div>
      {!unlimited && (
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              nearLimit ? "bg-amber-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function BillingDashboard({ plans, subscription, usage, invoices, isAdmin, orgId }: BillingDashboardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const currentPlan = (subscription?.plan_id ?? "free") as BillingPlan;
  const limits = PLAN_LIMITS[currentPlan];

  const handleCheckout = async (planId: string) => {
    if (!isAdmin) {
      toast.error("Only admins can manage billing");
      return;
    }
    setLoading(planId);
    try {
      const res = await fetch("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? "Failed to start checkout");
      }
    } catch {
      toast.error("Failed to start checkout");
    } finally {
      setLoading(null);
    }
  };

  const handlePortal = async () => {
    if (!isAdmin) {
      toast.error("Only admins can manage billing");
      return;
    }
    setLoading("portal");
    try {
      const res = await fetch("/api/v1/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? "Failed to open billing portal");
      }
    } catch {
      toast.error("Failed to open billing portal");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Current plan + usage */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current Plan</CardTitle>
              <Badge variant={currentPlan === "free" ? "secondary" : "default"} className="text-xs">
                {limits.name}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar label="Requests this month" current={usage.requests} limit={limits.maxRequests} />
            <UsageBar label="Connections" current={usage.connections} limit={limits.maxConnections} />
            <UsageBar label="Team members" current={usage.teamMembers} limit={limits.maxTeamMembers} />

            {subscription?.stripe_customer_id && isAdmin && (
              <Button variant="outline" size="sm" onClick={handlePortal} disabled={loading === "portal"} className="mt-2 gap-2">
                <CreditCard className="size-4" />
                {loading === "portal" ? "Opening..." : "Manage billing"}
                <ExternalLink className="size-3" />
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Quick upgrade CTA */}
        {currentPlan === "free" && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-8 text-center">
              <Zap className="size-8 text-primary" />
              <div>
                <p className="font-semibold">Upgrade to Pro</p>
                <p className="text-sm text-muted-foreground">Unlimited requests, Slack notifications, and more.</p>
              </div>
              <Button onClick={() => handleCheckout("pro")} disabled={loading === "pro"} className="gap-2">
                {loading === "pro" ? "Loading..." : "Upgrade — $20/mo"}
                <ArrowRight className="size-4" />
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Plan comparison */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Plans</h3>
          <div className="flex items-center gap-0 rounded-lg border bg-muted/50 p-0.5">
            <button
              onClick={() => setBillingCycle("monthly")}
              className={cn(
                "relative rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                billingCycle === "monthly"
                  ? "bg-white text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle("yearly")}
              className={cn(
                "relative rounded-md px-4 py-1.5 text-sm font-medium transition-all",
                billingCycle === "yearly"
                  ? "bg-white text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Yearly
              <span className={cn(
                "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                billingCycle === "yearly" ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary",
              )}>
                -20%
              </span>
            </button>
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
              <Card key={planId} className={cn("relative", isCurrent && "border-primary ring-1 ring-primary/20")}>
                {isCurrent && (
                  <div className="absolute -top-3 left-4">
                    <Badge className="bg-primary text-xs">Current plan</Badge>
                  </div>
                )}
                <CardContent className="pt-6">
                  <div className="mb-4 h-[88px]">
                    <h4 className="text-lg font-bold">{plan.name}</h4>
                    <p className="text-2xl font-bold">
                      {displayPrice === 0 && planId !== "enterprise" ? "Free" : isEnterprise ? "Custom" : `$${displayPrice}`}
                      {displayPrice > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                    </p>
                    <p className="h-4 text-xs text-muted-foreground">
                      {billingCycle === "yearly" && plan.priceYearly > 0
                        ? `$${plan.priceYearly}/yr billed annually`
                        : billingCycle === "monthly" && plan.priceMonthly > 0
                          ? "billed monthly"
                          : "\u00A0"}
                    </p>
                  </div>
                  <ul className="mb-4 space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-primary" />
                      {isUnlimited(plan.maxRequests) ? "Unlimited" : plan.maxRequests} requests/mo
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-primary" />
                      {isUnlimited(plan.maxConnections) ? "Unlimited" : plan.maxConnections} connections
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-primary" />
                      {isUnlimited(plan.maxTeamMembers) ? "Unlimited" : plan.maxTeamMembers} team members
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="size-4 text-primary" />
                      {isUnlimited(plan.historyDays) ? "Unlimited" : `${plan.historyDays}-day`} history
                    </li>
                  </ul>
                  {isAdmin && isUpgrade && !isEnterprise && (
                    <Button
                      className="w-full"
                      onClick={() => handleCheckout(planId)}
                      disabled={loading === planId}
                    >
                      {loading === planId ? "Loading..." : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                  {isEnterprise && isUpgrade && (
                    <Button variant="outline" className="w-full" asChild>
                      <a href="mailto:support@okrunit.com">Contact sales</a>
                    </Button>
                  )}
                  {isCurrent && (
                    <p className="mt-2 text-center text-xs text-muted-foreground">Your current plan</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Invoice history */}
      {invoices.length > 0 && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Invoice History</h3>
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-3">${(inv.amount_cents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-xs">
                          {inv.status}
                        </Badge>
                      </td>
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
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
