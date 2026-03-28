import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import {
  checkIpRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/api/ip-rate-limiter";
import { emailCard, emailLayout, escapeHtml } from "@/lib/email/layout";

const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  email: z.string().email("Invalid email address").max(200),
  subject: z.string().min(1, "Subject is required").max(300),
  message: z.string().min(1, "Message is required").max(5000),
});

const CONTACT_RATE_LIMIT = {
  limit: 5,
  windowSeconds: 600,
} as const;

const FROM_EMAIL =
  process.env.EMAIL_FROM ??
  process.env.RESEND_FROM_EMAIL ??
  "OKRunit <noreply@okrunit.com>";
const CONTACT_EMAIL_TO =
  process.env.CONTACT_EMAIL_TO ?? "support@okrunit.com";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`contact:${ip}`, CONTACT_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const body = contactSchema.parse(await request.json());

    if (!process.env.RESEND_API_KEY) {
      console.warn("[Contact] RESEND_API_KEY is not set");
      return NextResponse.json(
        { error: "Contact form is not configured yet." },
        { status: 503 },
      );
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const html = emailLayout({
      preheader: `Contact form: ${body.subject}`,
      body: emailCard(
        `<p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">Contact Form Submission</p>` +
          `<p style="margin:0 0 16px;font-size:16px;font-weight:600;">${escapeHtml(body.subject)}</p>` +
          `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">` +
          `<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;width:60px;">From</td><td style="padding:6px 0;font-size:13px;font-weight:500;">${escapeHtml(body.name)}</td></tr>` +
          `<tr><td style="padding:6px 0;font-size:13px;color:#6b7280;">Email</td><td style="padding:6px 0;font-size:13px;"><a href="mailto:${escapeHtml(body.email)}" style="color:#16a34a;">${escapeHtml(body.email)}</a></td></tr>` +
          `</table>` +
          `<div style="padding:16px;background:#f9fafb;border-radius:8px;font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(body.message)}</div>`,
        { tone: "neutral" },
      ),
    });

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: CONTACT_EMAIL_TO,
      replyTo: body.email,
      subject: `[Contact] ${body.subject}`,
      html,
    });

    if (error) {
      console.error("[Contact] Resend API error:", error);
      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }

    console.error("[Contact] Unexpected error:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
