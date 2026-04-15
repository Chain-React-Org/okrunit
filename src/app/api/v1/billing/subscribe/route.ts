import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
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
    .select("stripe_customer_id, stripe_subscription_id, status, plan_id")
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

  const stripeSub = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    metadata: { org_id: org.id, plan_id },
    expand: ["latest_invoice.payment_intent"],
  });

  const invoice = stripeSub.latest_invoice;
  const paymentIntent =
    typeof invoice === "object" && invoice !== null && "payment_intent" in invoice
      ? invoice.payment_intent
      : null;

  const clientSecret =
    typeof paymentIntent === "object" && paymentIntent !== null && "client_secret" in paymentIntent
      ? (paymentIntent as { client_secret: string }).client_secret
      : null;

  if (!clientSecret) {
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 });
  }

  return NextResponse.json({
    subscriptionId: stripeSub.id,
    clientSecret,
  });
}
