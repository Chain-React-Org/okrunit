import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

/**
 * GET: List payment methods for the customer.
 * PUT: Set a payment method as the default for the subscription.
 */
export async function GET() {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { org } = ctx;
  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_customer_id, stripe_subscription_id")
    .eq("org_id", org.id)
    .single();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ paymentMethods: [], defaultPaymentMethodId: null });
  }

  const stripe = getStripeOrThrow();
  const methods = await stripe.paymentMethods.list({
    customer: subscription.stripe_customer_id,
    type: "card",
  });

  let defaultPaymentMethodId: string | null = null;
  if (subscription.stripe_subscription_id) {
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    const defaultPm = stripeSub.default_payment_method;
    defaultPaymentMethodId = typeof defaultPm === "string" ? defaultPm : defaultPm?.id ?? null;
  }

  return NextResponse.json({
    paymentMethods: methods.data.map((pm) => ({
      id: pm.id,
      brand: pm.card?.brand ?? "unknown",
      last4: pm.card?.last4 ?? "????",
      expMonth: pm.card?.exp_month,
      expYear: pm.card?.exp_year,
    })),
    defaultPaymentMethodId,
  });
}

const SetDefaultSchema = z.object({
  payment_method_id: z.string(),
});

export async function PUT(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { org, membership } = ctx;
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = SetDefaultSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, stripe_customer_id")
    .eq("org_id", org.id)
    .single();

  if (!subscription?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  const stripe = getStripeOrThrow();

  // Update both the subscription and customer default payment method
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    default_payment_method: parsed.data.payment_method_id,
  });

  if (subscription.stripe_customer_id) {
    await stripe.customers.update(subscription.stripe_customer_id, {
      invoice_settings: { default_payment_method: parsed.data.payment_method_id },
    });
  }

  return NextResponse.json({ success: true });
}
