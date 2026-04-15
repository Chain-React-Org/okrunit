// ---------------------------------------------------------------------------
// OKrunit -- Resend Webhook Handler
// ---------------------------------------------------------------------------
// Receives email delivery events from Resend (bounces, complaints,
// delivery confirmations). Logs events and flags problematic addresses.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureError } from "@/lib/monitoring/capture";
import { Webhook } from "svix";

interface ResendEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    bounce?: {
      message: string;
      type: string;
    };
    complaint?: {
      feedback_type: string;
    };
  };
}

export async function POST(request: Request) {
  try {
    // Verify Resend webhook signature
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    const rawBody = await request.text();

    if (!webhookSecret) {
      console.error("[Resend Webhook] RESEND_WEBHOOK_SECRET is not configured");
      return new NextResponse(null, { status: 500 });
    }

    {
      const svixId = request.headers.get("svix-id");
      const svixTimestamp = request.headers.get("svix-timestamp");
      const svixSignature = request.headers.get("svix-signature");

      if (!svixId || !svixTimestamp || !svixSignature) {
        return new NextResponse(null, { status: 401 });
      }

      try {
        const wh = new Webhook(webhookSecret);
        wh.verify(rawBody, {
          "svix-id": svixId,
          "svix-timestamp": svixTimestamp,
          "svix-signature": svixSignature,
        });
      } catch {
        return new NextResponse(null, { status: 401 });
      }
    }

    const body = JSON.parse(rawBody) as ResendEvent;

    // Resend sends: email.sent, email.delivered, email.bounced,
    // email.complained, email.delivery_delayed
    const eventType = body.type;
    const recipients = body.data?.to ?? [];

    // Only track bounces and complaints
    if (eventType !== "email.bounced" && eventType !== "email.complained") {
      return new NextResponse(null, { status: 200 });
    }

    const admin = createAdminClient();

    for (const email of recipients) {
      // Find the user by email
      const { data: profile } = await admin
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (!profile) continue;

      // Log the event in audit log
      const { data: membership } = await admin
        .from("org_memberships")
        .select("org_id")
        .eq("user_id", profile.id)
        .eq("is_default", true)
        .single();

      if (membership) {
        await admin.from("audit_log").insert({
          org_id: membership.org_id,
          user_id: profile.id,
          action: eventType === "email.bounced" ? "email.bounced" : "email.complained",
          resource_type: "email",
          resource_id: body.data.email_id,
          details: {
            email,
            subject: body.data.subject,
            bounce_type: body.data.bounce?.type,
            bounce_message: body.data.bounce?.message,
            complaint_type: body.data.complaint?.feedback_type,
          },
        });
      }

      // On hard bounce, disable email notifications for this user
      if (
        eventType === "email.bounced" &&
        body.data.bounce?.type === "hard"
      ) {
        await admin
          .from("notification_settings")
          .upsert(
            {
              user_id: profile.id,
              email_enabled: false,
            },
            { onConflict: "user_id" },
          );

        console.warn(
          `[Resend] Hard bounce for ${email}, disabled email notifications`,
        );
      }
    }

    return new NextResponse(null, { status: 200 });
  } catch (error) {
    captureError({
      error,
      service: "Resend Webhook",
      severity: "warning",
    }).catch(() => {});

    return new NextResponse(null, { status: 200 }); // Always 200 to prevent retries
  }
}
