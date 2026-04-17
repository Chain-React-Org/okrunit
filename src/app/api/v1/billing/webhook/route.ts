import { NextRequest, NextResponse } from "next/server";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import { createInAppNotificationBulk } from "@/lib/notifications/in-app";
import type Stripe from "stripe";
import { logger } from "@/lib/monitoring/logger";

export async function POST(req: NextRequest) {
  const stripe = getStripeOrThrow();
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const admin = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const orgId = session.metadata?.org_id;
      const planId = session.metadata?.plan_id;
      if (!orgId || !planId) break;

      const stripeSubId = typeof session.subscription === "string" ? session.subscription : null;

      // Fetch the full subscription from Stripe to get period dates and billing interval
      let periodStart: string | null = null;
      let periodEnd: string | null = null;
      let billingCycle: "monthly" | "yearly" = "monthly";

      let subStatus: "active" | "trialing" = "active";
      let trialEnd: string | null = null;

      if (stripeSubId) {
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubId) as unknown as Record<string, unknown>;
        const pStart = stripeSub.current_period_start;
        const pEnd = stripeSub.current_period_end;
        if (typeof pStart === "number") {
          periodStart = new Date(pStart * 1000).toISOString();
        }
        if (typeof pEnd === "number") {
          periodEnd = new Date(pEnd * 1000).toISOString();
        }
        // Determine billing cycle from the price interval
        const items = stripeSub.items as { data?: Array<{ price?: { recurring?: { interval?: string } } }> } | undefined;
        if (items?.data?.[0]?.price?.recurring?.interval === "year") {
          billingCycle = "yearly";
        }
        // Check if subscription is in trial
        if (stripeSub.status === "trialing") subStatus = "trialing";
        const rawTrialEnd = stripeSub.trial_end;
        if (typeof rawTrialEnd === "number") trialEnd = new Date(rawTrialEnd * 1000).toISOString();
      }

      const { error: subError } = await admin
        .from("subscriptions")
        .upsert({
          org_id: orgId,
          plan_id: planId,
          status: subStatus,
          billing_cycle: billingCycle,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripe_subscription_id: stripeSubId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          trial_end: trialEnd,
          cancelled_at: null,
          pending_plan_id: null,
          has_had_paid_subscription: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: "org_id" });

      if (subError) {
        logger.error("[Billing Webhook] Failed to upsert subscription:", subError);
      }

      await admin
        .from("organizations")
        .update({ plan_id: planId })
        .eq("id", orgId);

      revalidateTags(CacheTags.subscription(orgId));

      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object;
      const orgId = sub.metadata?.org_id;
      if (!orgId) break;

      const status = sub.status === "active" ? "active"
        : sub.status === "past_due" ? "past_due"
        : sub.status === "trialing" ? "trialing"
        : sub.status === "canceled" ? "cancelled"
        : "expired";

      const updateData: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };

      // Track trial_end from Stripe
      const rawTrialEnd = (sub as unknown as Record<string, unknown>).trial_end;
      if (typeof rawTrialEnd === "number") {
        updateData.trial_end = new Date(rawTrialEnd * 1000).toISOString();
      }

      // Access period dates safely (Stripe SDK types vary by version)
      const raw = sub as unknown as Record<string, unknown>;
      const periodStart = raw.current_period_start;
      const periodEnd = raw.current_period_end;
      const canceledAt = raw.canceled_at;

      if (typeof periodStart === "number") updateData.current_period_start = new Date(periodStart * 1000).toISOString();
      if (typeof periodEnd === "number") updateData.current_period_end = new Date(periodEnd * 1000).toISOString();
      if (typeof canceledAt === "number") updateData.cancelled_at = new Date(canceledAt * 1000).toISOString();
      else updateData.cancelled_at = null;

      // Check if this is a billing period renewal (period_start changed).
      // If there's a pending downgrade, apply it now.
      const { data: existingSub } = await admin
        .from("subscriptions")
        .select("current_period_start, pending_plan_id")
        .eq("org_id", orgId)
        .single();

      const newPeriodStart = typeof periodStart === "number"
        ? new Date(periodStart * 1000).toISOString()
        : null;

      const periodRenewed = existingSub
        && newPeriodStart
        && existingSub.current_period_start
        && newPeriodStart !== existingSub.current_period_start;

      // If subscription just became active (e.g. from incomplete via custom checkout),
      // ensure plan_id and billing_cycle are set from metadata.
      if (status === "active" && sub.metadata?.plan_id) {
        const items = sub.items?.data;
        const interval = items?.[0]?.price?.recurring?.interval;

        updateData.plan_id = sub.metadata.plan_id;
        updateData.stripe_subscription_id = sub.id;
        updateData.billing_cycle = interval === "year" ? "yearly" : "monthly";

        // Update org plan_id
        await admin
          .from("organizations")
          .update({ plan_id: sub.metadata.plan_id })
          .eq("id", orgId);
      }

      if (periodRenewed && existingSub.pending_plan_id) {
        // Apply the deferred downgrade
        updateData.plan_id = existingSub.pending_plan_id;
        updateData.pending_plan_id = null;

        await admin
          .from("organizations")
          .update({ plan_id: existingSub.pending_plan_id })
          .eq("id", orgId);

        // Clear the pending_plan_id from Stripe metadata too
        const pendingPlanId = sub.metadata?.pending_plan_id;
        if (pendingPlanId) {
          await stripe.subscriptions.update(sub.id, {
            metadata: { ...sub.metadata, plan_id: existingSub.pending_plan_id, pending_plan_id: "" },
          });
        }
      }

      await admin
        .from("subscriptions")
        .update(updateData)
        .eq("org_id", orgId);

      revalidateTags(CacheTags.subscription(orgId));

      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object;
      const orgId = sub.metadata?.org_id;
      if (!orgId) break;

      await admin
        .from("subscriptions")
        .update({
          plan_id: "free",
          status: "cancelled",
          stripe_subscription_id: null,
          cancelled_at: new Date().toISOString(),
          pending_plan_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", orgId);

      await admin
        .from("organizations")
        .update({ plan_id: "free" })
        .eq("id", orgId);

      revalidateTags(CacheTags.subscription(orgId));

      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      const { data: subscription } = await admin
        .from("subscriptions")
        .select("org_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (subscription) {
        await admin.from("invoices").upsert({
          org_id: subscription.org_id,
          stripe_invoice_id: invoice.id,
          status: "paid",
          amount_cents: invoice.amount_paid ?? 0,
          currency: invoice.currency ?? "usd",
          hosted_invoice_url: invoice.hosted_invoice_url,
          pdf_url: invoice.invoice_pdf,
          updated_at: new Date().toISOString(),
        }, { onConflict: "stripe_invoice_id" });
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      const { data: subscription } = await admin
        .from("subscriptions")
        .select("org_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (subscription) {
        await admin
          .from("subscriptions")
          .update({ status: "past_due", updated_at: new Date().toISOString() })
          .eq("org_id", subscription.org_id);
      }
      break;
    }

    case "invoice.payment_action_required": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      const { data: subscription } = await admin
        .from("subscriptions")
        .select("org_id")
        .eq("stripe_customer_id", customerId)
        .single();

      if (subscription) {
        // Notify all org admins/owners that payment requires action
        const { data: admins } = await admin
          .from("org_memberships")
          .select("user_id")
          .eq("org_id", subscription.org_id)
          .in("role", ["owner", "admin"]);

        if (admins?.length) {
          const actionUrl = invoice.hosted_invoice_url ?? "/org/subscription";
          createInAppNotificationBulk(
            admins.map((a) => a.user_id),
            {
              orgId: subscription.org_id,
              category: "billing",
              title: "Payment requires action",
              body: `Your bank requires additional verification to process your subscription payment. Please complete the verification to avoid service interruption.`,
              resourceType: "billing",
              resourceId: typeof actionUrl === "string" ? actionUrl : undefined,
            },
          );
        }
      }
      break;
    }

    case "customer.subscription.created": {
      const sub = event.data.object;
      const orgId = sub.metadata?.org_id;
      const planId = sub.metadata?.plan_id;
      if (!orgId || !planId) break;

      logger.info(`[Billing Webhook] Subscription created: org=${orgId} plan=${planId} status=${sub.status}`);
      break;
    }

    case "customer.subscription.trial_will_end": {
      const sub = event.data.object;
      const orgId = sub.metadata?.org_id;
      if (!orgId) break;

      // Notify all org admins/owners that their trial ends in 3 days
      const { data: admins } = await admin
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", orgId)
        .in("role", ["owner", "admin"]);

      if (admins?.length) {
        createInAppNotificationBulk(
          admins.map((a) => a.user_id),
          {
            orgId,
            category: "billing",
            title: "Your trial ends in 3 days",
            body: "Add a payment method to keep your Pro features. When you subscribe, you'll get 40% off your first 3 months on the monthly plan.",
            resourceType: "billing",
            resourceId: "/org/subscription",
          },
        );
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
