"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Shield, ArrowLeft, ArrowUp } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import type { BillingPlan } from "@/lib/types/database";

interface UpgradeConfirmFormProps {
  planId: BillingPlan;
  billingCycle: "monthly" | "yearly";
}

export function UpgradeConfirmForm({ planId, billingCycle }: UpgradeConfirmFormProps) {
  const [processing, setProcessing] = useState(false);

  const plan = PLAN_LIMITS[planId];
  const monthlyPrice = billingCycle === "yearly" ? Math.round(plan.priceYearly / 12) : plan.priceMonthly;
  const displayTotal = billingCycle === "yearly" ? plan.priceYearly : plan.priceMonthly;

  const savingsPercent = billingCycle === "yearly"
    ? Math.round((1 - plan.priceYearly / (plan.priceMonthly * 12)) * 100)
    : 0;

  const handleConfirmUpgrade = async () => {
    setProcessing(true);
    try {
      const res = await fetch("/api/v1/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Upgraded to ${plan.name}. The prorated difference will be charged to your card on file.`);
        window.location.href = "/org/subscription?success=true";
      } else {
        toast.error(data.error ?? "Failed to upgrade");
        setProcessing(false);
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
      setProcessing(false);
    }
  };

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
              <h2 className="text-lg font-semibold">Upgrade summary</h2>

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
                  <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                    You save {savingsPercent}% with annual billing
                  </div>
                )}

                <div className="border-t pt-3">
                  <div className="flex items-center justify-between font-semibold">
                    <span>New rate</span>
                    <span>${displayTotal}.00/{billingCycle === "yearly" ? "yr" : "mo"}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    The prorated difference for the rest of your current billing period will be charged to your card on file.
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

        {/* Confirmation */}
        <div className="md:col-span-3">
          <Card>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold">Confirm your upgrade</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                You are upgrading to the {plan.name} plan. Your new features will be available immediately.
              </p>

              <div className="mt-6 space-y-4">
                <div className="rounded-md border bg-muted/50 px-4 py-3 text-sm space-y-2">
                  <div className="flex items-start gap-2">
                    <ArrowUp className="mt-0.5 size-4 text-primary" />
                    <span>Your plan will upgrade immediately</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Shield className="mt-0.5 size-4 text-primary" />
                    <span>You will be charged the prorated difference for the remainder of your current billing period</span>
                  </div>
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleConfirmUpgrade}
                  disabled={processing}
                >
                  {processing ? "Processing..." : `Confirm upgrade to ${plan.name}`}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  By confirming, you agree to be charged the prorated amount on your card on file.
                  You can downgrade or cancel anytime from your subscription page.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
