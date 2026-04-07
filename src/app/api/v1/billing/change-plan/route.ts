import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import { PLAN_ORDER } from "@/lib/billing/plans";
import { z } from "zod";

const ChangePlanSchema = z.object({
  plan_id: z.enum(["pro", "business"]),
});

export async function POST(req: NextRequest) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { org, membership } = ctx;
  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can manage billing" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = ChangePlanSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { plan_id } = parsed.data;
  const admin = createAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status, plan_id")
    .eq("org_id", org.id)
    .single();

  if (!subscription?.stripe_subscription_id || subscription.status !== "active") {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  // Only allow downgrades through this endpoint
  const currentIdx = PLAN_ORDER.indexOf(subscription.plan_id as typeof PLAN_ORDER[number]);
  const targetIdx = PLAN_ORDER.indexOf(plan_id);
  if (targetIdx >= currentIdx) {
    return NextResponse.json({ error: "Use checkout for upgrades" }, { status: 400 });
  }

  const stripe = getStripeOrThrow();

  // Look up the new price ID from the plans table
  const { data: targetPlan } = await admin
    .from("plans")
    .select("stripe_price_id_monthly, stripe_price_id_yearly")
    .eq("id", plan_id)
    .single();

  if (!targetPlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Retrieve current subscription to determine billing interval
  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
  const currentItem = stripeSub.items.data[0];
  if (!currentItem) {
    return NextResponse.json({ error: "Subscription has no items" }, { status: 500 });
  }

  const isYearly = currentItem.price.recurring?.interval === "year";
  const newPriceId = isYearly ? targetPlan.stripe_price_id_yearly : targetPlan.stripe_price_id_monthly;

  if (!newPriceId) {
    return NextResponse.json({ error: "Stripe price not configured for target plan" }, { status: 400 });
  }

  // Schedule the downgrade at the end of the current billing period
  // by using proration_behavior: none and billing_cycle_anchor: unchanged
  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    items: [{ id: currentItem.id, price: newPriceId }],
    proration_behavior: "none",
    metadata: { ...stripeSub.metadata, plan_id },
  });

  // Update the plan_id in our database immediately so limits reflect the downgrade
  await admin
    .from("subscriptions")
    .update({ plan_id, updated_at: new Date().toISOString() })
    .eq("org_id", org.id);

  await admin
    .from("organizations")
    .update({ plan_id })
    .eq("id", org.id);

  revalidateTags(CacheTags.subscription(org.id));

  return NextResponse.json({ success: true });
}
