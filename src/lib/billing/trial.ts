import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Free trial duration for new subscribers (days). */
export const TRIAL_PERIOD_DAYS = 14;

/** New customer discount: 40% off the first 3 months. */
export const NEW_CUSTOMER_DISCOUNT_PERCENT = 40;
export const NEW_CUSTOMER_DISCOUNT_MONTHS = 3;

/**
 * Returns true if this org has never had a paid subscription,
 * making them eligible for the new-customer discount.
 */
export async function isFirstTimeSubscriber(orgId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("has_had_paid_subscription")
    .eq("org_id", orgId)
    .single();

  return !data?.has_had_paid_subscription;
}

/**
 * Gets or creates the Stripe coupon for new customers (40% off, 3 months).
 * Uses a fixed coupon ID so it's created once and reused.
 */
export async function getNewCustomerCoupon(stripe: Stripe): Promise<string> {
  const couponId = "new_customer_40pct_3mo";

  try {
    await stripe.coupons.retrieve(couponId);
    return couponId;
  } catch {
    // Coupon doesn't exist yet, create it
    await stripe.coupons.create({
      id: couponId,
      percent_off: NEW_CUSTOMER_DISCOUNT_PERCENT,
      duration: "repeating",
      duration_in_months: NEW_CUSTOMER_DISCOUNT_MONTHS,
      name: "New Customer - 40% Off First 3 Months",
    });
    return couponId;
  }
}
