"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import type { ReactNode } from "react";

let stripePromise: Promise<Stripe | null> | null = null;

function getStripe() {
  if (!stripePromise) {
    const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!key) {
      console.error("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set");
      return null;
    }
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}

interface StripeProviderProps {
  clientSecret: string;
  children: ReactNode;
}

export function StripeProvider({ clientSecret, children }: StripeProviderProps) {
  return (
    <Elements
      stripe={getStripe()}
      options={{
        clientSecret,
        appearance: {
          theme: "stripe",
          variables: {
            colorPrimary: "#18181b",
            colorBackground: "#ffffff",
            colorText: "#18181b",
            colorDanger: "#ef4444",
            borderRadius: "8px",
            fontFamily: "inherit",
            spacingUnit: "4px",
            colorTextSecondary: "#71717a",
          },
          rules: {
            ".DropdownItem": {
              fontSize: "14px",
              padding: "8px 12px",
            },
            ".DropdownItem--highlight": {
              backgroundColor: "#f4f4f5",
              color: "#18181b",
            },
          },
        },
      }}
    >
      {children}
    </Elements>
  );
}
