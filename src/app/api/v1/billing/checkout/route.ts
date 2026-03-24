import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const CheckoutSchema = z.object({
  plan_id: z.enum(["pro", "business"]),
  billing_cycle: z.enum(["monthly", "yearly"]).default("monthly"),
  success_url: z.string().url().optional(),
  cancel_url: z.string().url().optional(),
});

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { org, membership } = ctx;
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = CheckoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const stripe = getStripeOrThrow();
  const admin = createAdminClient();
  const { plan_id, billing_cycle, success_url, cancel_url } = parsed.data;

  const { data: plan } = await admin
    .from("plans")
    .select("stripe_price_id_monthly, stripe_price_id_yearly")
    .eq("id", plan_id)
    .single();

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  const priceId = billing_cycle === "yearly"
    ? plan.stripe_price_id_yearly
    : plan.stripe_price_id_monthly;

  if (!priceId) return NextResponse.json({ error: "Stripe price not configured for this plan" }, { status: 400 });

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("org_id", org.id)
    .single();

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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: success_url ?? `${appUrl}/billing?success=true`,
    cancel_url: cancel_url ?? `${appUrl}/billing?cancelled=true`,
    metadata: { org_id: org.id, plan_id },
    subscription_data: {
      metadata: { org_id: org.id, plan_id },
    },
  });

  return NextResponse.json({ url: session.url });
}
