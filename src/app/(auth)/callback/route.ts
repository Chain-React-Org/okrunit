import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWelcomeEmailHtml } from "@/lib/email/welcome";
import { logger } from "@/lib/monitoring/logger";
import { safeRedirectUrl } from "@/lib/redirect";

const FROM_EMAIL = process.env.EMAIL_FROM || "OKrunit <noreply@okrunit.com>";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("invite");

  // redirect_to can come from query params (email/password login) or from a
  // cookie set before the OAuth provider round-trip (social login).
  const redirectTo =
    searchParams.get("redirect_to") ||
    decodeURIComponent(request.cookies.get("oauth_redirect_to")?.value ?? "") ||
    null;

  if (!code) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", "Missing authorization code");
    return NextResponse.redirect(loginUrl);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const loginUrl = new URL("/login", origin);
    loginUrl.searchParams.set("error", error.message);
    return NextResponse.redirect(loginUrl);
  }

  // Send welcome email on first sign-in (when profile doesn't exist yet)
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();

  if (user && process.env.RESEND_API_KEY) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    // Only send welcome email if this is a new user (no profile yet)
    if (!profile) {
      try {
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || "there";
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
  }

  // If there's an invite token, route through the invite acceptance page
  // which handles email verification, profile creation, and org membership.
  if (inviteToken) {
    return NextResponse.redirect(new URL(`/invite/${inviteToken}`, origin));
  }

  // Check if this user has completed onboarding setup.
  // New users (no profile yet, or setup_completed_at is null) go to /setup.
  if (user) {
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("setup_completed_at")
      .eq("id", user.id)
      .single();

    if (!existingProfile || !existingProfile.setup_completed_at) {
      return NextResponse.redirect(new URL("/setup", origin));
    }
  }

  // Check if user has MFA enrolled. Redirect to verification if so
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel === "aal1" && aal?.nextLevel === "aal2") {
    const mfaUrl = new URL("/mfa-verify", origin);
    if (redirectTo) {
      mfaUrl.searchParams.set("redirect_to", redirectTo);
    }
    const mfaResponse = NextResponse.redirect(mfaUrl);
    mfaResponse.cookies.delete("oauth_redirect_to");
    return mfaResponse;
  }

  // If there's a redirect_to param (e.g. from OAuth authorize flow), go there
  const finalResponse = NextResponse.redirect(new URL(safeRedirectUrl(redirectTo), origin));
  finalResponse.cookies.delete("oauth_redirect_to");
  return finalResponse;
}
