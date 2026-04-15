import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import { PLAN_ORDER } from "@/lib/billing/plans";
import { z } from "zod";

const ChangePlanSchema = z.object({
  plan_id: z.enum(["pro", "business"]),
  billing_cycle: z.enum(["monthly", "yearly"]).optional(),
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

  const { plan_id, billing_cycle: requestedCycle } = parsed.data;
  const admin = createAdminClient();

  const { data: subscription } = await admin
    .from("subscriptions")
    .select("stripe_subscription_id, status, plan_id, billing_cycle")
    .eq("org_id", org.id)
    .single();

  if (!subscription?.stripe_subscription_id || subscription.status !== "active") {
    return NextResponse.json({ error: "No active subscription" }, { status: 400 });
  }

  if (subscription.plan_id === plan_id) {
    return NextResponse.json({ error: "Already on this plan" }, { status: 400 });
  }

  const currentIdx = PLAN_ORDER.indexOf(subscription.plan_id as typeof PLAN_ORDER[number]);
  const targetIdx = PLAN_ORDER.indexOf(plan_id);
  const isUpgrade = targetIdx > currentIdx;

  const stripe = getStripeOrThrow();

  const { data: targetPlan } = await admin
    .from("plans")
    .select("stripe_price_id_monthly, stripe_price_id_yearly")
    .eq("id", plan_id)
    .single();

  if (!targetPlan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  // Retrieve current subscription to determine billing interval and item
  const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
  const currentItem = stripeSub.items.data[0];
  if (!currentItem) {
    return NextResponse.json({ error: "Subscription has no items" }, { status: 500 });
  }

  const currentIsYearly = currentItem.price.recurring?.interval === "year";
  // Use requested cycle if provided, otherwise keep the current cycle
  const isYearly = requestedCycle ? requestedCycle === "yearly" : currentIsYearly;
  const newPriceId = isYearly ? targetPlan.stripe_price_id_yearly : targetPlan.stripe_price_id_monthly;
  const newBillingCycle = isYearly ? "yearly" : "monthly";

  if (!newPriceId) {
    return NextResponse.json({ error: "Stripe price not configured for target plan" }, { status: 400 });
  }

  if (isUpgrade) {
    // Upgrade: prorate and charge the difference immediately.
    // Using "always_invoice" creates a separate invoice for the proration
    // and pays it right away, so the next renewal is a clean full-price charge.
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: "always_invoice",
      metadata: { ...stripeSub.metadata, plan_id },
    });

    // Update our database immediately so user gets new features right away
    await admin
      .from("subscriptions")
      .update({
        plan_id,
        billing_cycle: newBillingCycle,
        pending_plan_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", org.id);

    await admin
      .from("organizations")
      .update({ plan_id })
      .eq("id", org.id);

    revalidateTags(CacheTags.subscription(org.id));

    return NextResponse.json({ success: true, action: "upgraded" });
  } else {
    // Downgrade: no proration, user keeps current features until period ends.
    // Update the Stripe price so the lower amount is charged at next renewal.
    await stripe.subscriptions.update(subscription.stripe_subscription_id, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: "none",
      metadata: { ...stripeSub.metadata, pending_plan_id: plan_id },
    });

    // Store the pending downgrade. Don't change plan_id yet.
    await admin
      .from("subscriptions")
      .update({
        pending_plan_id: plan_id,
        updated_at: new Date().toISOString(),
      })
      .eq("org_id", org.id);

    revalidateTags(CacheTags.subscription(org.id));

    return NextResponse.json({ success: true, action: "downgrade_scheduled" });
  }
}
