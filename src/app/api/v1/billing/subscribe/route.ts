import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { isFirstTimeSubscriber, getNewCustomerCoupon } from "@/lib/billing/trial";
import { z } from "zod";

const SubscribeSchema = z.object({
  plan_id: z.enum(["pro", "business"]),
  billing_cycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

/**
 * Creates a Stripe subscription with `payment_behavior: "default_incomplete"`.
 * Returns the client secret so the frontend can confirm payment via Stripe Elements.
 */
export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { org, membership } = ctx;
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = SubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const stripe = getStripeOrThrow();
  const admin = createAdminClient();
  const { plan_id, billing_cycle } = parsed.data;

  const { data: plan } = await admin
    .from("plans")
    .select("stripe_price_id_monthly, stripe_price_id_yearly")
    .eq("id", plan_id)
    .single();

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const priceId = billing_cycle === "yearly"
    ? plan.stripe_price_id_yearly
    : plan.stripe_price_id_monthly;

  if (!priceId) return NextResponse.json({ error: "Stripe price not configured" }, { status: 400 });

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id, status, plan_id, trial_end")
    .eq("org_id", org.id)
    .single();

  if (subscription?.stripe_subscription_id && subscription.status === "active" && subscription.plan_id !== "free") {
    return NextResponse.json(
      { error: "You already have an active subscription. Use plan change to switch plans." },
      { status: 409 },
    );
  }

  let customerId = subscription?.stripe_customer_id;

  if (!customerId) {
    const customer = await stripe.customers.create({
      metadata: { org_id: org.id, org_name: org.name },
    });
    customerId = customer.id;

    await admin
      .from("subscriptions")
      .update({ stripe_customer_id: customerId })
      .eq("org_id", org.id);
  }

  // Check if this org qualifies for the new customer discount (40% off first 3 months)
  const firstTime = await isFirstTimeSubscriber(org.id);
  const couponId = firstTime ? await getNewCustomerCoupon(stripe) : undefined;

  // If the org is currently on a DB trial with time remaining, carry
  // that trial over to Stripe so the first charge happens after it ends.
  const isOnTrial = subscription?.status === "trialing" && subscription.trial_end;
  const trialEndTimestamp = isOnTrial
    ? Math.max(
        Math.floor(new Date(subscription.trial_end!).getTime() / 1000),
        Math.floor(Date.now() / 1000) + 60, // Stripe requires at least 48 hours in the future, use 60s minimum as safety
      )
    : undefined;

  let stripeSub;
  try {
    stripeSub = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: "default_incomplete",
      payment_settings: { save_default_payment_method: "on_subscription" },
      metadata: { org_id: org.id, plan_id },
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      ...(trialEndTimestamp ? { trial_end: trialEndTimestamp } : {}),
      expand: ["latest_invoice.payment_intent"],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe subscription creation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  // When there's a trial, Stripe doesn't charge yet. We create a SetupIntent
  // manually to collect the card for future charges.
  // When there's no trial, Stripe creates a PaymentIntent to charge immediately.
  let clientSecret: string | null = null;
  let mode: "setup" | "payment" = "payment";

  if (stripeSub.status === "trialing") {
    // Create a SetupIntent to save the card for when the trial ends
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      metadata: { org_id: org.id, subscription_id: stripeSub.id },
      usage: "off_session",
    });
    clientSecret = setupIntent.client_secret;
    mode = "setup";
  } else {
    // Extract PaymentIntent client secret
    const invoice = stripeSub.latest_invoice;
    const paymentIntent =
      typeof invoice === "object" && invoice !== null && "payment_intent" in invoice
        ? invoice.payment_intent
        : null;

    if (typeof paymentIntent === "object" && paymentIntent !== null && "client_secret" in paymentIntent) {
      clientSecret = (paymentIntent as { client_secret: string }).client_secret;
    }
  }

  if (!clientSecret) {
    if (stripeSub.id) {
      try { await stripe.subscriptions.cancel(stripeSub.id); } catch { /* best effort */ }
    }
    return NextResponse.json(
      { error: "Could not initialize checkout. If you already have a subscription, use the upgrade option on the subscription page." },
      { status: 400 },
    );
  }

  // Mark as having had a paid subscription
  await admin
    .from("subscriptions")
    .update({
      has_had_paid_subscription: true,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSub.id,
    })
    .eq("org_id", org.id);

  return NextResponse.json({
    subscriptionId: stripeSub.id,
    clientSecret,
    mode,
  });
}
