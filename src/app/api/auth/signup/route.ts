// ---------------------------------------------------------------------------
// OKrunit -- Custom Sign-Up Route
// ---------------------------------------------------------------------------
// Creates the user via Supabase admin, then sends a branded confirmation
// email through Resend instead of Supabase's default plain-text email.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";
import { buildConfirmEmailHtml } from "@/lib/email/confirm";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const FROM_EMAIL =
  process.env.EMAIL_FROM || "OKrunit <noreply@okrunit.com>";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[a-z]/, "Password must contain a lowercase letter")
    .regex(/\d/, "Password must contain a number")
    .regex(/[^A-Za-z0-9]/, "Password must contain a special character"),
  fullName: z.string().min(1, "Full name is required"),
  inviteToken: z.string().optional(),
  visitorId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    const body = signupSchema.parse(await request.json());
    const admin = createAdminClient();

    // Build the redirect URL for after email confirmation.
    const redirectTo = new URL("/callback", APP_URL);
    if (body.inviteToken) {
      redirectTo.searchParams.set("invite", body.inviteToken);
    }

    // Generate a sign-up confirmation link via Supabase admin.
    // This creates the user in auth.users WITHOUT sending Supabase's default
    // email, giving us control over the email content.
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "signup",
        email: body.email,
        password: body.password,
        options: {
          data: { full_name: body.fullName },
          redirectTo: redirectTo.toString(),
        },
      });

    if (linkError) {
      // Handle duplicate email gracefully.
      if (
        linkError.message?.includes("already been registered") ||
        linkError.message?.includes("already exists")
      ) {
        return NextResponse.json(
          { error: "An account with this email already exists." },
          { status: 409 },
        );
      }
      console.error("[Auth] generateLink error:", linkError);
      return NextResponse.json(
        { error: linkError.message || "Failed to create account" },
        { status: 400 },
      );
    }

    // Extract the token from Supabase's action link and build our own
    // verification URL so the email never exposes the raw Supabase domain.
    const actionLink = linkData.properties?.action_link ?? "";
    let confirmLink = actionLink;

    try {
      const actionUrl = new URL(actionLink);
      const tokenHash = actionUrl.searchParams.get("token");
      const type = actionUrl.searchParams.get("type") || "signup";

      if (tokenHash) {
        const verifyUrl = new URL("/api/auth/verify", APP_URL);
        verifyUrl.searchParams.set("token_hash", tokenHash);
        verifyUrl.searchParams.set("type", type);
        if (body.inviteToken) {
          verifyUrl.searchParams.set("invite", body.inviteToken);
        }
        confirmLink = verifyUrl.toString();
      }
    } catch {
      // If URL parsing fails, fall back to the raw action link
      console.warn("[Auth] Failed to parse action link, using raw Supabase URL");
    }

    // Send the branded confirmation email via Resend.
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        const html = buildConfirmEmailHtml({
          fullName: body.fullName,
          confirmLink,
        });

        const { error: emailError } = await resend.emails.send({
          from: FROM_EMAIL,
          to: body.email,
          subject: "Confirm your OKrunit account",
          html,
        });

        if (emailError) {
          console.error("[Auth] Resend API error:", emailError);
        }
      } catch (emailErr) {
        console.error("[Auth] Failed to send confirmation email:", emailErr);
      }
    } else {
      console.warn(
        "[Auth] RESEND_API_KEY is not set -- skipping confirmation email for:",
        body.email,
      );
    }

    // Link visitor tracking data to the new user
    if (body.visitorId && linkData.user?.id) {
      admin
        .from("visitor_tracking")
        .update({ user_id: linkData.user.id, signed_up_at: new Date().toISOString() })
        .eq("visitor_id", body.visitorId)
        .then();
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    console.error("[Auth] Unexpected signup error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
