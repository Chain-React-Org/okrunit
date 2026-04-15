import { NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

/**
 * Reactivates a subscription that was cancelled but hasn't expired yet.
 * Removes the cancel_at_period_end flag on Stripe.
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
    .select("stripe_subscription_id, status, cancelled_at")
    .eq("org_id", org.id)
    .single();

  if (!subscription?.stripe_subscription_id) {
    return NextResponse.json({ error: "No subscription found" }, { status: 400 });
  }

  if (!subscription.cancelled_at) {
    return NextResponse.json({ error: "Subscription is not cancelled" }, { status: 400 });
  }

  const stripe = getStripeOrThrow();

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    cancel_at_period_end: false,
  });

  await admin
    .from("subscriptions")
    .update({ cancelled_at: null, updated_at: new Date().toISOString() })
    .eq("org_id", org.id);

  revalidateTags(CacheTags.subscription(org.id));

  return NextResponse.json({ success: true });
}
