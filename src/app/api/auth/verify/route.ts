// ---------------------------------------------------------------------------
// OKrunit -- Email Verification Route
// ---------------------------------------------------------------------------
// Handles email verification tokens on our own domain so confirmation emails
// never expose the raw Supabase URL to users. Verifies the OTP, sends the
// welcome email for new users, and redirects to setup or dashboard.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWelcomeEmailHtml } from "@/lib/email/welcome";
import { logger } from "@/lib/monitoring/logger";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";
import {
  checkIpRateLimit,
  getClientIp,
  AUTH_RATE_LIMIT,
} from "@/lib/api/ip-rate-limiter";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const FROM_EMAIL =
  process.env.EMAIL_FROM || "OKrunit <noreply@okrunit.com>";

export async function GET(request: NextRequest) {
  // Rate limit by IP to slow down OTP token bruteforce. Supabase itself
  // rate-limits verifyOtp, but layering our own check keeps the entire
  // round-trip cheap and prevents wasting an outbound Supabase call per
  // guess.
  const rl = checkIpRateLimit(`otp-verify:${getClientIp(request)}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.redirect(
      new URL("/login?error=too_many_attempts", APP_URL),
    );
  }

  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "signup" | "email" | "magiclink" | "recovery" | "invite" | undefined;
  const inviteToken = searchParams.get("invite");

  if (!tokenHash || !type) {
    return NextResponse.redirect(
      new URL("/login?error=invalid_verification_link", APP_URL),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    logger.error("[Auth] OTP verification failed:", error.message);
    return NextResponse.redirect(
      new URL("/login?error=verification_failed", APP_URL),
    );
  }

  // Send welcome email on first sign-in (when profile doesn't exist yet)
  const { data: { user } } = await supabase.auth.getUser();

  // Invalidate org context cache so the dashboard sees the profile/org/membership
  // that the handle_new_user trigger just created.
  if (user) {
    revalidateTags(CacheTags.orgContext(user.id), CacheTags.dashboard(user.id));
  }

  if (user && process.env.RESEND_API_KEY) {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id, setup_completed_at")
      .eq("id", user.id)
      .single();

    if (!profile) {
      // New user. Send welcome email
      try {
        const fullName = user.user_metadata?.full_name || "there";
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: FROM_EMAIL,
          to: user.email!,
          subject: "Welcome to OKrunit!",
          html: buildWelcomeEmailHtml({ fullName }),
        });
      } catch (err) {
        logger.error("[Auth] Failed to send welcome email:", err);
      }
    }

    // Route to invite acceptance if there's an invite token
    if (inviteToken) {
      return NextResponse.redirect(new URL(`/invite/${inviteToken}`, APP_URL));
    }

    // Route new users (no profile or setup not completed) to setup
    if (!profile || !profile.setup_completed_at) {
      return NextResponse.redirect(new URL("/setup", APP_URL));
    }
  }

  // Route to invite acceptance if there's an invite token
  if (inviteToken) {
    return NextResponse.redirect(new URL(`/invite/${inviteToken}`, APP_URL));
  }

  return NextResponse.redirect(new URL("/org/overview", APP_URL));
}
