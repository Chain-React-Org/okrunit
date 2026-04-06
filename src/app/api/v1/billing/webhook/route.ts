import { NextRequest, NextResponse } from "next/server";
import { getStripeOrThrow } from "@/lib/billing/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import type Stripe from "stripe";

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
      }

      await admin
        .from("subscriptions")
        .update({
          plan_id: planId,
          status: "active",
          billing_cycle: billingCycle,
          stripe_customer_id: typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripe_subscription_id: stripeSubId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancelled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("org_id", orgId);

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

      // Access period dates safely (Stripe SDK types vary by version)
      const raw = sub as unknown as Record<string, unknown>;
      const periodStart = raw.current_period_start;
      const periodEnd = raw.current_period_end;
      const canceledAt = raw.canceled_at;

      if (typeof periodStart === "number") updateData.current_period_start = new Date(periodStart * 1000).toISOString();
      if (typeof periodEnd === "number") updateData.current_period_end = new Date(periodEnd * 1000).toISOString();
      if (typeof canceledAt === "number") updateData.cancelled_at = new Date(canceledAt * 1000).toISOString();
      else updateData.cancelled_at = null;

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
  }

  return NextResponse.json({ received: true });
}
