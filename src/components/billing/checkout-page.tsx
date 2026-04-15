"use client";

import { useEffect, useState } from "react";
import { StripeProvider } from "./stripe-provider";
import { CheckoutForm } from "./checkout-form";
import { UpgradeConfirmForm } from "./upgrade-confirm-form";
import { toast } from "sonner";
import type { BillingPlan } from "@/lib/types/database";

interface CheckoutPageProps {
  planId: "pro" | "business";
  billingCycle: "monthly" | "yearly";
  isUpgrade?: boolean;
}

function NewSubscriptionCheckout({ planId, billingCycle }: { planId: BillingPlan; billingCycle: "monthly" | "yearly" }) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function createSubscription() {
      try {
        const res = await fetch("/api/v1/billing/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan_id: planId, billing_cycle: billingCycle }),
        });
        const data = await res.json();

        if (cancelled) return;

        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          setError(data.error ?? "Failed to initialize checkout");
          toast.error(data.error ?? "Failed to initialize checkout");
        }
      } catch {
        if (!cancelled) {
          setError("Something went wrong. Please try again.");
          toast.error("Something went wrong. Please try again.");
        }
      }
    }

    createSubscription();
    return () => { cancelled = true; };
  }, [planId, billingCycle]);

  if (error) {
    return (
      <div className="mx-auto max-w-lg text-center py-12">
        <p className="text-muted-foreground">{error}</p>
        <a href="/org/subscription" className="mt-4 inline-block text-sm text-primary underline underline-offset-2">
          Back to plans
        </a>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="mx-auto max-w-lg text-center py-12">
        <div className="inline-block size-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <p className="mt-3 text-sm text-muted-foreground">Preparing checkout...</p>
      </div>
    );
  }

  return (
    <StripeProvider clientSecret={clientSecret}>
      <CheckoutForm planId={planId} billingCycle={billingCycle} />
    </StripeProvider>
  );
}

export function CheckoutPage({ planId, billingCycle, isUpgrade }: CheckoutPageProps) {
  if (isUpgrade) {
    return <UpgradeConfirmForm planId={planId as BillingPlan} billingCycle={billingCycle} />;
  }

  return <NewSubscriptionCheckout planId={planId as BillingPlan} billingCycle={billingCycle} />;
}
