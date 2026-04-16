"use client";

import { useState } from "react";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Shield, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import type { BillingPlan } from "@/lib/types/database";

interface CheckoutFormProps {
  planId: BillingPlan;
  billingCycle: "monthly" | "yearly";
  /** "setup" saves card for later (trial), "payment" charges immediately */
  mode?: "setup" | "payment";
}

export function CheckoutForm({ planId, billingCycle, mode = "payment" }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const plan = PLAN_LIMITS[planId];
  const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly * 12;
  const monthlyPrice = billingCycle === "yearly" ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
  const displayTotal = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;
  const isTrialSetup = mode === "setup";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const appUrl = window.location.origin;
    const returnUrl = `${appUrl}/org/subscription?success=true`;

    if (isTrialSetup) {
      // Save card for later charge (trial). No payment now.
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: { return_url: returnUrl },
        redirect: "if_required",
      });

      if (result.error) {
        toast.error(result.error.message ?? "Failed to save payment method. Please try again.");
        setProcessing(false);
        return;
      }

      // Set the saved payment method as default on the subscription
      const pmId = result.setupIntent?.payment_method;
      if (pmId && typeof pmId === "string") {
        const res = await fetch("/api/v1/billing/payment-methods", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_method_id: pmId }),
        });
        if (!res.ok) {
          toast.error("Card saved but failed to set as default. Please update your payment method on the billing page.");
        }
      }

      window.location.href = returnUrl;
    } else {
      // Charge immediately
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl },
      });

      if (error) {
        toast.error(error.message ?? "Payment failed. Please try again.");
        setProcessing(false);
      }
    }
    // If successful, the page redirects to return_url
  };

  const savingsPercent = billingCycle === "yearly"
    ? Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/org/subscription"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-4" />
        Back to plans
      </Link>

      <div className="grid gap-6 md:grid-cols-5">
        {/* Order summary */}
        <div className="md:col-span-2">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold">Order summary</h2>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-medium">{plan.name}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {billingCycle === "yearly" ? "Annual" : "Monthly"}
                    </Badge>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground">
                  ${monthlyPrice}/mo {billingCycle === "yearly" && `(billed annually)`}
                </div>

                {savingsPercent > 0 && (
                  <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
                    You save {savingsPercent}% with annual billing
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Total due today</span>
                    <span>{isTrialSetup ? "$0.00" : `$${displayTotal}.00`}</span>
                  </div>
                  {isTrialSetup && billingCycle === "monthly" ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">After trial (first 3 months)</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground line-through text-xs">${displayTotal}.00/mo</span>
                          <span className="font-medium text-green-700">${Math.round(displayTotal * 0.6)}.00/mo</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">After that</span>
                        <span className="font-medium">${displayTotal}.00/mo</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        40% off your first 3 months. Cancel anytime.
                      </p>
                    </div>
                  ) : isTrialSetup ? (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">After trial</span>
                        <span className="font-medium">${displayTotal}.00/yr</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Renews annually. Cancel anytime.
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {billingCycle === "yearly" ? "Renews annually" : "Renews monthly"}. Cancel anytime.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 border-t pt-4">
                <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Included
                </p>
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary" />
                    Unlimited requests
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary" />
                    {plan.maxConnections === -1 ? "Unlimited" : plan.maxConnections} connections
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary" />
                    {plan.maxTeams === -1 ? "Unlimited" : plan.maxTeams} teams
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-3.5 text-primary" />
                    {plan.historyDays === -1 ? "Unlimited" : `${plan.historyDays}-day`} history
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment form */}
        <div className="md:col-span-3">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold">Payment details</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {isTrialSetup
                  ? "Add your card to continue after your trial. You won't be charged until your trial ends."
                  : "Enter your card information to subscribe."}
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <PaymentElement
                  options={{
                    layout: "tabs",
                  }}
                />

                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={!stripe || processing}
                >
                  {processing
                    ? "Processing..."
                    : isTrialSetup
                      ? "Save card and continue trial"
                      : `Subscribe for $${displayTotal}.00/${billingCycle === "yearly" ? "yr" : "mo"}`}
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                  <Shield className="size-3.5" />
                  Secured by Stripe. Your card details never touch our servers.
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
