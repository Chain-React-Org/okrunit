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
}

export function CheckoutForm({ planId, billingCycle }: CheckoutFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);

  const plan = PLAN_LIMITS[planId];
  const price = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly * 12;
  const monthlyPrice = billingCycle === "yearly" ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
  const displayTotal = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    const appUrl = window.location.origin;

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${appUrl}/org/subscription?success=true`,
      },
    });

    if (error) {
      toast.error(error.message ?? "Payment failed. Please try again.");
      setProcessing(false);
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
                    <span>${displayTotal}.00</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {billingCycle === "yearly" ? "Renews annually" : "Renews monthly"}. Cancel anytime.
                  </p>
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
                Enter your card information to subscribe.
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
                  {processing ? "Processing..." : `Subscribe for $${displayTotal}.00/${billingCycle === "yearly" ? "yr" : "mo"}`}
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
