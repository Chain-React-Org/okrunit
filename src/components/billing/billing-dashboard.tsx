"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, AlertTriangle, RefreshCw, ExternalLink, Shield, Plus, Infinity } from "lucide-react";
import { cn } from "@/lib/utils";
import { PLAN_LIMITS, isUnlimited, PLAN_ORDER } from "@/lib/billing/plans";
import type { Plan, Subscription, Invoice, BillingPlan } from "@/lib/types/database";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StripeProvider } from "./stripe-provider";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

/** Human-readable labels for feature keys */
const FEATURE_LABELS: Record<string, string> = {
  email_notifications: "Email Notifications",
  custom_email_branding: "Custom Email Branding",
  slack_notifications: "Slack Notifications",
  webhook_notifications: "Webhook Notifications",
  rules_engine: "Rules Engine",
  analytics: "Analytics",
  api_access: "API Access",
  scheduled_approvals: "Scheduled Approvals",
  analytics_export: "Analytics Export",
  sso_saml: "SSO / SAML",
  audit_log_export: "Audit Log Export",
  multi_step_approvals: "Multi-Step Approvals",
  custom_routing: "Custom Routing",
  ip_allowlist: "IP Allowlist",
  geo_restrictions: "Geo Restrictions",
  webhook_retry_config: "Webhook Retry Config",
  dedicated_support: "Dedicated Support",
  custom_sla: "Custom SLA",
  priority_processing: "Priority Processing",
  community_support: "Community Support",
  scim_provisioning: "SCIM Provisioning",
  custom_data_retention: "Custom Data Retention",
  dedicated_instance: "Dedicated Instance",
  custom_integrations: "Custom Integrations",
  uptime_sla: "Uptime SLA (99.9%)",
  compliance_certifications: "Compliance (SOC2, HIPAA)",
  onboarding_training: "Onboarding & Training",
};

function featureLabel(key: string): string {
  return FEATURE_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  Usage Row                                                          */
/* ------------------------------------------------------------------ */

function UsageRow({ label, used, limit, suffix }: { label: string; used: number; limit: number; suffix?: string }) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited ? 0 : Math.round((used / limit) * 100);

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
      <div className="flex flex-col gap-2 flex-1 sm:flex-row sm:items-center sm:gap-3">
        <span className="text-sm font-medium text-muted-foreground w-20 sm:w-24">{label}</span>
        <div className="flex items-center gap-3 flex-1 max-w-md">
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              {unlimited ? (
                <span className="text-sm flex items-center gap-1.5">
                  <span className="font-medium">{used.toLocaleString()}</span>
                  <span className="text-muted-foreground">used</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Infinity className="size-3" />
                    Unlimited
                  </span>
                  {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
                </span>
              ) : (
                <span className="text-sm">
                  <span className="font-medium">{used.toLocaleString()}</span>
                  <span className="text-muted-foreground"> of {limit.toLocaleString()}</span>
                  {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
                </span>
              )}
            </div>
            {!unlimited && (
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    pct >= 90 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-primary",
                  )}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Payment method types                                               */
/* ------------------------------------------------------------------ */

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

/* ------------------------------------------------------------------ */
/*  Update Card Form (embedded Stripe Elements)                        */
/* ------------------------------------------------------------------ */

function UpdateCardForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const result = await stripe.confirmSetup({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (result.error) {
      toast.error(result.error.message ?? "Failed to update card");
      setProcessing(false);
      return;
    }

    // Set the new payment method as default on the subscription
    const pmId = result.setupIntent?.payment_method;
    if (pmId && typeof pmId === "string") {
      const res = await fetch("/api/v1/billing/payment-methods", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method_id: pmId }),
      });
      if (!res.ok) {
        toast.error("Card saved but failed to set as default. Please try again.");
        setProcessing(false);
        return;
      }
    }

    toast.success("Payment method updated");
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!stripe || processing}>
          {processing ? "Saving..." : "Save card"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={processing}>
          Cancel
        </Button>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Shield className="size-3" />
        Secured by Stripe
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Payment Method Section                                             */
/* ------------------------------------------------------------------ */

function PaymentMethodSection({ isAdmin }: { isAdmin: boolean }) {
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [defaultId, setDefaultId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);

  const fetchMethods = useCallback(async () => {
    const res = await fetch("/api/v1/billing/payment-methods");
    const data = await res.json();
    setMethods(data.paymentMethods ?? []);
    setDefaultId(data.defaultPaymentMethodId ?? null);
    setLoaded(true);
  }, []);

  useEffect(() => { fetchMethods(); }, [fetchMethods]);

  const handleStartUpdate = async () => {
    const res = await fetch("/api/v1/billing/setup-intent", { method: "POST" });
    const data = await res.json();
    if (data.clientSecret) {
      setSetupSecret(data.clientSecret);
      setShowUpdateForm(true);
    } else {
      toast.error(data.error ?? "Failed to start card update");
    }
  };

  const handleUpdateSuccess = () => {
    setShowUpdateForm(false);
    setSetupSecret(null);
    fetchMethods();
  };

  if (!loaded) return null;

  const defaultMethod = methods.find((m) => m.id === defaultId) ?? methods[0];

  return (
    <div className="divide-y rounded-lg border bg-white dark:bg-card">
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <span className="text-sm font-medium text-muted-foreground w-20 sm:w-24">Payment</span>
          {defaultMethod ? (
            <div className="flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              <span className="text-sm capitalize">{defaultMethod.brand}</span>
              <span className="text-sm text-muted-foreground">ending in {defaultMethod.last4}</span>
              <span className="text-xs text-muted-foreground">
                {String(defaultMethod.expMonth).padStart(2, "0")}/{defaultMethod.expYear}
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No payment method on file</span>
          )}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleStartUpdate} className="text-xs gap-1.5">
              {defaultMethod ? (
                <>
                  <RefreshCw className="size-3.5" />
                  Update card
                </>
              ) : (
                <>
                  <Plus className="size-3.5" />
                  Add card
                </>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              asChild
            >
              <a href="/org/billing">
                <CreditCard className="size-3.5" />
                Manage billing
              </a>
            </Button>
          </div>
        )}
      </div>

      {showUpdateForm && setupSecret && (
        <div className="px-4 py-4 sm:px-5">
          <StripeProvider clientSecret={setupSecret}>
            <UpdateCardForm onSuccess={handleUpdateSuccess} onCancel={() => { setShowUpdateForm(false); setSetupSecret(null); }} />
          </StripeProvider>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Billing Dashboard                                             */
/* ------------------------------------------------------------------ */

interface BillingDashboardProps {
  plans: Plan[];
  subscription: Subscription | null;
  planOverride?: BillingPlan | null;
  usage: {
    requests: number;
    connections: number;
    teams: number;
    teamMembers: number;
  };
  invoices: Invoice[];
  isAdmin: boolean;
  orgId: string;
}

export function BillingDashboard({ plans, subscription, planOverride, usage, invoices, isAdmin, orgId }: BillingDashboardProps) {
  const [loading, setLoading] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">(
    subscription?.stripe_subscription_id
      ? (subscription.billing_cycle as "monthly" | "yearly") ?? "yearly"
      : "yearly"
  );
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDowngrade, setConfirmDowngrade] = useState<string | null>(null);
  const subscriptionPlan = (subscription?.plan_id ?? "free") as BillingPlan;
  const currentPlan = (planOverride ?? subscriptionPlan) as BillingPlan;
  const limits = PLAN_LIMITS[currentPlan];
  const hasPaidSub = subscription?.stripe_subscription_id && (subscription.status === "active" || subscription.status === "trialing") && subscriptionPlan !== "free";
  const isTrialing = subscription?.status === "trialing";
  const trialDaysLeft = isTrialing && subscription?.trial_end
    ? Math.max(0, Math.ceil((new Date(subscription.trial_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  const handleCheckout = (planId: string) => {
    if (!isAdmin) { toast.error("Only admins can manage billing"); return; }
    // Always redirect to checkout page so the user can review and confirm
    const params = new URLSearchParams({ plan: planId, cycle: billingCycle });
    if (hasPaidSub) params.set("upgrade", "true");
    window.location.href = `/org/checkout?${params.toString()}`;
  };

  const handleCancel = async () => {
    setConfirmCancel(false);
    setLoading("cancel");
    try {
      const res = await fetch("/api/v1/billing/cancel", { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Subscription cancelled. You'll keep access until your billing period ends."); window.location.reload(); }
      else toast.error(data.error ?? "Failed to cancel subscription");
    } catch { toast.error("Failed to cancel subscription"); }
    finally { setLoading(null); }
  };

  const handleReactivate = async () => {
    setLoading("reactivate");
    try {
      const res = await fetch("/api/v1/billing/reactivate", { method: "POST" });
      const data = await res.json();
      if (data.success) { toast.success("Subscription reactivated!"); window.location.reload(); }
      else toast.error(data.error ?? "Failed to reactivate");
    } catch { toast.error("Failed to reactivate"); }
    finally { setLoading(null); }
  };

  const handleDowngrade = async (planId: string) => {
    setConfirmDowngrade(null);
    setLoading(`downgrade-${planId}`);
    try {
      const res = await fetch("/api/v1/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          data.action === "downgrade_scheduled"
            ? `Downgrade to ${PLAN_LIMITS[planId as BillingPlan]?.name ?? planId} scheduled. You'll keep your current features until the end of your billing period.`
            : `Downgraded to ${PLAN_LIMITS[planId as BillingPlan]?.name ?? planId}`,
        );
        window.location.reload();
      } else toast.error(data.error ?? "Failed to downgrade");
    } catch { toast.error("Failed to downgrade"); }
    finally { setLoading(null); }
  };

  const requestsSuffix = isUnlimited(limits.maxRequests) ? "" : " this month";

  return (
    <div className="space-y-10">
      {/* ── Trial Banner ── */}
      {isTrialing && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold">
                You&apos;re on a free trial of {limits.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {trialDaysLeft > 0
                  ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} remaining. Add a payment method to keep your plan after the trial ends.`
                  : "Your trial ends today. Add a payment method to keep your plan."}
              </p>
            </div>
            {isAdmin && (
              <Button
                size="sm"
                className="mt-2 sm:mt-0"
                onClick={() => {
                  const params = new URLSearchParams({ plan: subscriptionPlan, cycle: billingCycle });
                  window.location.href = `/org/checkout?${params.toString()}`;
                }}
              >
                Subscribe now
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── Subscription Details ── */}
      <div>
        <h3 className="mb-4 text-lg font-semibold">Subscription</h3>
        <div className="divide-y rounded-lg border bg-white dark:bg-card">
          {/* Row: My plan */}
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium text-muted-foreground w-20 sm:w-24">My plan</span>
              <Badge variant={currentPlan === "free" ? "secondary" : "default"} className="text-xs">
                {limits.name}
              </Badge>
              {isTrialing && (
                <Badge variant="outline" className="text-xs border-primary text-primary">
                  Trial
                </Badge>
              )}
              {planOverride && (
                <Badge variant="outline" className="text-xs border-amber-500 text-amber-600 dark:text-amber-400">
                  Admin override
                </Badge>
              )}
            </div>
          </div>

          {/* Row: Billing */}
          <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="text-sm font-medium text-muted-foreground w-20 sm:w-24">Billing</span>
              <span className="text-sm">
                {currentPlan === "free"
                  ? "$0.00"
                  : isTrialing
                    ? "$0.00 (free trial)"
                    : subscription?.billing_cycle === "yearly"
                      ? `$${limits.priceYearly}.00 / year`
                      : `$${limits.priceMonthly}.00 / month`}
              </span>
            </div>
          </div>

          {/* Row: Next billing / Renewal / Trial end */}
          {currentPlan !== "free" && (subscription?.current_period_end || subscription?.trial_end) && (
            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-sm font-medium text-muted-foreground w-20 sm:w-24">
                  {isTrialing ? "Trial ends" : subscription?.cancelled_at ? "Expires" : "Renews"}
                </span>
                <span className="text-sm">
                  {new Date(isTrialing && subscription?.trial_end ? subscription.trial_end : subscription?.current_period_end ?? "").toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
                {subscription.cancelled_at && (
                  <Badge variant="secondary" className="text-xs">Cancelled</Badge>
                )}
              </div>
              {isAdmin && subscription.cancelled_at && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReactivate}
                  disabled={loading === "reactivate"}
                  className="text-xs gap-1.5"
                >
                  <RefreshCw className="size-3.5" />
                  {loading === "reactivate" ? "Reactivating..." : "Reactivate"}
                </Button>
              )}
            </div>
          )}

          {/* Row: Pending downgrade */}
          {subscription?.pending_plan_id && (
            <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-sm font-medium text-muted-foreground w-20 sm:w-24">Scheduled</span>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-3.5 text-amber-500" />
                  <span className="text-sm">
                    Downgrade to {PLAN_LIMITS[subscription.pending_plan_id as BillingPlan]?.name ?? subscription.pending_plan_id} at end of billing period
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Row: Usage - Requests */}
          <UsageRow label="Requests" used={usage.requests} limit={limits.maxRequests} suffix={requestsSuffix} />

          {/* Row: Connections */}
          <UsageRow label="Connections" used={usage.connections} limit={limits.maxConnections} />

          {/* Row: Teams */}
          <UsageRow label="Teams" used={usage.teams} limit={limits.maxTeams} />

          {/* Row: Team Members */}
          <UsageRow label="Members" used={usage.teamMembers} limit={limits.maxTeamMembers} />
        </div>
      </div>

      {/* ── Payment Method ── */}
      {hasPaidSub && (
        <div>
          <h3 className="mb-4 text-lg font-semibold">Payment Method</h3>
          <PaymentMethodSection isAdmin={isAdmin} />
          {isAdmin && (
            <div className="mt-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/v1/billing/portal", { method: "POST" });
                    const data = await res.json();
                    if (data.url) window.open(data.url, "_blank");
                    else toast.error(data.error ?? "Failed to open billing portal");
                  } catch { toast.error("Failed to open billing portal"); }
                }}
              >
                <ExternalLink className="size-3.5" />
                Manage billing
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Compare Plans ── */}
      <div id="plans">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold">Compare Plans</h3>
          <div className="flex items-center gap-2 text-sm sm:gap-3">
            <span className={cn("font-medium text-xs sm:text-sm", billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground")}>
              Monthly
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
            <span className={cn("font-medium text-xs sm:text-sm", billingCycle === "yearly" ? "text-foreground" : "text-muted-foreground")}>
              Yearly{" "}
              <span className="hidden text-primary font-semibold sm:inline">(Save 15%+)</span>
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
                isEnterprise && "bg-zinc-900 text-white border-zinc-800",
                !isEnterprise && planId !== "free" && "bg-white dark:bg-card",
              )}>
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-xs">Your plan</Badge>
                  </div>
                )}
                <CardContent className="pt-6">
                  {/* Price area */}
                  <div className="mb-5 h-[100px]">
                    <h4 className={cn("text-base font-bold", !isEnterprise && "text-black dark:text-foreground")}>{plan.name}</h4>
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
                        onClick={() => handleCheckout(planId)}
                        disabled={loading === planId}
                      >
                        {loading === planId ? "Loading..." : `Buy ${billingCycle} plan`}
                      </Button>
                    )}
                    {isEnterprise && isUpgrade && (
                      <a
                        href="mailto:support@okrunit.com"
                        className="flex w-full items-center justify-center rounded-md border border-white/30 bg-transparent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/10"
                      >
                        Talk to sales
                      </a>
                    )}
                    {isCurrent && (
                      <p className={cn("text-center text-xs", isEnterprise ? "text-white/60" : "text-muted-foreground")}>
                        Your current plan
                      </p>
                    )}
                    {isAdmin && !isCurrent && !isUpgrade && !isEnterprise && planId !== "free" && currentPlan !== "free" && (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => setConfirmDowngrade(planId)}
                        disabled={loading === `downgrade-${planId}`}
                      >
                        {loading === `downgrade-${planId}` ? "Loading..." : "Downgrade"}
                      </Button>
                    )}
                    {isAdmin && !isCurrent && planId === "free" && currentPlan !== "free" && !subscription?.cancelled_at && (
                      <Button
                        className="w-full"
                        variant="outline"
                        onClick={() => setConfirmCancel(true)}
                        disabled={loading === "cancel"}
                      >
                        {loading === "cancel" ? "Loading..." : "Cancel Subscription"}
                      </Button>
                    )}
                    {!isCurrent && planId === "free" && currentPlan !== "free" && subscription?.cancelled_at && (
                      <p className="text-center text-xs text-muted-foreground">
                        Cancellation pending
                      </p>
                    )}
                    {((!isAdmin && !isCurrent && !isUpgrade) || (currentPlan === "free" && planId === "free")) && !isCurrent && (
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
                        {isUnlimited(plan.maxOrganizations) ? "Unlimited" : plan.maxOrganizations} organization{plan.maxOrganizations !== 1 ? "s" : ""}
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className={cn("size-4 shrink-0 mt-0.5", isEnterprise ? "text-white/80" : "text-primary")} />
                        {isUnlimited(plan.maxConnections) ? "Unlimited" : plan.maxConnections} connections
                      </li>
                      <li className="flex items-start gap-2">
                        <Check className={cn("size-4 shrink-0 mt-0.5", isEnterprise ? "text-white/80" : "text-primary")} />
                        {isUnlimited(plan.maxTeams) ? "Unlimited" : plan.maxTeams} team{plan.maxTeams !== 1 ? "s" : ""}
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
                        const prevPlan = planIdx > 0 ? PLAN_LIMITS[PLAN_ORDER[planIdx - 1]] : null;
                        return !prevPlan || !prevPlan.features.includes(f);
                      }).slice(0, 4).map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check className={cn("size-4 shrink-0 mt-0.5", isEnterprise ? "text-white/80" : "text-primary")} />
                          {featureLabel(f)}
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

      {/* ── Comparison Table ── */}
      <div>
        <h3 className="mb-5 text-lg font-semibold">Comparison table</h3>
        <div className="overflow-x-auto rounded-lg border bg-white dark:bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-5 py-3 text-left font-normal text-muted-foreground w-[160px] sm:w-[240px]" />
                {PLAN_ORDER.map((planId) => {
                  const isCurrent = planId === currentPlan;
                  return (
                    <th key={planId} className={cn("px-4 py-3 text-center font-semibold text-black dark:text-foreground", isCurrent && "bg-primary/5")}>
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
                { label: "Organizations", key: "maxOrganizations" },
                { label: "Connections", key: "maxConnections" },
                { label: "Teams", key: "maxTeams" },
                { label: "Team members", key: "maxTeamMembers" },
                { label: "History retention", key: "historyDays" },
                { label: "Email notifications", feature: "email_notifications" },
                { label: "Custom email branding", feature: "custom_email_branding" },
                { label: "Slack notifications", feature: "slack_notifications" },
                { label: "Webhook notifications", feature: "webhook_notifications" },
                { label: "Rules engine", feature: "rules_engine" },
                { label: "Analytics", feature: "analytics" },
                { label: "API access", feature: "api_access" },
                { label: "Scheduled approvals", feature: "scheduled_approvals" },
                { label: "Analytics export", feature: "analytics_export" },
                { label: "SSO / SAML", feature: "sso_saml" },
                { label: "Audit log export", feature: "audit_log_export" },
                { label: "Multi-step approvals", feature: "multi_step_approvals" },
                { label: "Custom routing", feature: "custom_routing" },
                { label: "IP allowlist", feature: "ip_allowlist" },
                { label: "Geo restrictions", feature: "geo_restrictions" },
                { label: "Webhook retry config", feature: "webhook_retry_config" },
                { label: "Dedicated support", feature: "dedicated_support" },
                { label: "Custom SLA", feature: "custom_sla" },
                { label: "Priority processing", feature: "priority_processing" },
                { label: "SCIM provisioning", feature: "scim_provisioning" },
                { label: "Custom data retention", feature: "custom_data_retention" },
                { label: "Dedicated instance", feature: "dedicated_instance" },
                { label: "Custom integrations", feature: "custom_integrations" },
                { label: "Uptime SLA (99.9%)", feature: "uptime_sla" },
                { label: "Compliance (SOC2, HIPAA)", feature: "compliance_certifications" },
                { label: "Onboarding & training", feature: "onboarding_training" },
              ].map((row) => (
                <tr key={row.label} className="hover:bg-muted/30 transition-colors">
                  <td className="px-5 py-3 text-muted-foreground">{row.label}</td>
                  {PLAN_ORDER.map((planId) => {
                    const plan = PLAN_LIMITS[planId];
                    const isCurrent = planId === currentPlan;
                    let value: string | React.ReactNode = "-";

                    if (row.key === "maxRequests") {
                      value = isUnlimited(plan.maxRequests) ? "Unlimited" : String(plan.maxRequests);
                    } else if (row.key === "maxOrganizations") {
                      value = isUnlimited(plan.maxOrganizations) ? "Unlimited" : String(plan.maxOrganizations);
                    } else if (row.key === "maxConnections") {
                      value = isUnlimited(plan.maxConnections) ? "Unlimited" : String(plan.maxConnections);
                    } else if (row.key === "maxTeams") {
                      value = isUnlimited(plan.maxTeams) ? "Unlimited" : String(plan.maxTeams);
                    } else if (row.key === "maxTeamMembers") {
                      value = isUnlimited(plan.maxTeamMembers) ? "Unlimited" : String(plan.maxTeamMembers);
                    } else if (row.key === "historyDays") {
                      value = isUnlimited(plan.historyDays) ? "Unlimited" : `${plan.historyDays} days`;
                    } else if (row.feature) {
                      value = plan.features.includes(row.feature)
                        ? <Check className="mx-auto size-4 text-primary" />
                        : <span className="text-muted-foreground/40">-</span>;
                    }

                    return (
                      <td key={planId} className={cn("px-4 py-3 text-center text-black dark:text-foreground", isCurrent && "bg-primary/5")}>
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
          <div className="overflow-x-auto rounded-lg border bg-white dark:bg-card">
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

      {/* ── Cancel Subscription Modal ── */}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel your subscription? You&apos;ll keep access to your current plan until the end of your billing period
              {subscription?.current_period_end && (
                <> on <strong>{new Date(subscription.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong></>
              )}.
              After that, your account will revert to the Free plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel}>
              Cancel Subscription
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Downgrade Plan Modal ── */}
      <AlertDialog open={!!confirmDowngrade} onOpenChange={(open) => !open && setConfirmDowngrade(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Downgrade to {confirmDowngrade ? PLAN_LIMITS[confirmDowngrade as BillingPlan]?.name : ""}</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll keep your current plan and features until your billing period ends
              {subscription?.current_period_end && (
                <> on <strong>{new Date(subscription.current_period_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</strong></>
              )}. After that, your plan will switch and the lower price will apply.
              {confirmDowngrade && (() => {
                const target = PLAN_LIMITS[confirmDowngrade as BillingPlan];
                return (
                  <span className="mt-3 block text-xs">
                    New limits after switch: {isUnlimited(target.maxConnections) ? "Unlimited" : target.maxConnections} connections, {isUnlimited(target.maxTeams) ? "Unlimited" : target.maxTeams} teams, {isUnlimited(target.maxTeamMembers) ? "Unlimited" : target.maxTeamMembers} members, {isUnlimited(target.historyDays) ? "Unlimited" : `${target.historyDays}-day`} history
                  </span>
                );
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Current Plan</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDowngrade && handleDowngrade(confirmDowngrade)}>
              Downgrade
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
