import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Creates a SetupIntent for updating the payment method on an existing subscription.
 * Returns the client secret for Stripe Elements to collect card details.
 */
export async function POST() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { org, membership } = ctx;
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", org.id)
    .single();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: "No billing account found" }, { status: 400 });
  }

  const stripe = getStripeOrThrow();
  const setupIntent = await stripe.setupIntents.create({
    customer: subscription.stripe_customer_id,
    payment_method_types: ["card"],
    metadata: { org_id: org.id },
  });

  return NextResponse.json({ clientSecret: setupIntent.client_secret });
}
