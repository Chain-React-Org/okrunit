import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildWelcomeEmailHtml } from "@/lib/email/welcome";
import { logger } from "@/lib/monitoring/logger";
import { safeRedirectUrl } from "@/lib/redirect";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

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

  // Invalidate the org context cache so the dashboard layout fetches fresh
  // data. The handle_new_user trigger may have just created the profile,
  // org, and membership, but a stale cache would return null and cause
  // a "no_org" redirect.
  if (user) {
    revalidateTags(CacheTags.orgContext(user.id), CacheTags.dashboard(user.id));
  }

  if (user) {
    const { data: profile } = await admin
      .from("user_profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    // If the handle_new_user trigger didn't create the required rows (e.g.
    // the auth user already existed from a previous attempt), create them
    // now so the user isn't stuck on the "no_org" error.
    if (!profile) {
      const resolvedName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.user_metadata?.preferred_username ||
        "";

      try {
        // Create org
        const { data: newOrg } = await admin
          .from("organizations")
          .insert({ name: "My Organization", plan_id: "pro" })
          .select("id")
          .single();

        if (newOrg) {
          // Create profile, membership, subscription, and default team
          await Promise.all([
            admin
              .from("user_profiles")
              .insert({ id: user.id, email: user.email!, full_name: resolvedName }),
            admin
              .from("org_memberships")
              .insert({ user_id: user.id, org_id: newOrg.id, role: "owner", is_default: true }),
            admin
              .from("subscriptions")
              .insert({
                org_id: newOrg.id,
                plan_id: "pro",
                status: "trialing",
                trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                current_period_start: new Date().toISOString(),
                current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              }),
            admin
              .from("teams")
              .insert({ org_id: newOrg.id, name: "My Team", created_by: user.id }),
          ]);
        }

        // Invalidate cache again after creating the data
        revalidateTags(CacheTags.orgContext(user.id), CacheTags.dashboard(user.id));

        logger.info("[Auth] Created missing org data for user via callback fallback", { userId: user.id });
      } catch (err) {
        logger.error("[Auth] Failed to create fallback org data:", err);
      }

      // Send welcome email for new user
      if (process.env.RESEND_API_KEY) {
        try {
          const fullName = resolvedName || "there";
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
    } else {
      // Profile exists. Check if the membership is missing (partial trigger failure).
      const { data: membership } = await admin
        .from("org_memberships")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!membership) {
        try {
          const { data: newOrg } = await admin
            .from("organizations")
            .insert({ name: "My Organization", plan_id: "pro" })
            .select("id")
            .single();

          if (newOrg) {
            await Promise.all([
              admin
                .from("org_memberships")
                .insert({ user_id: user.id, org_id: newOrg.id, role: "owner", is_default: true }),
              admin
                .from("subscriptions")
                .insert({
                  org_id: newOrg.id,
                  plan_id: "pro",
                  status: "trialing",
                  trial_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                  current_period_start: new Date().toISOString(),
                  current_period_end: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
                }),
              admin
                .from("teams")
                .insert({ org_id: newOrg.id, name: "My Team", created_by: user.id }),
            ]);
          }

          revalidateTags(CacheTags.orgContext(user.id), CacheTags.dashboard(user.id));
          logger.info("[Auth] Created missing membership/org for existing user", { userId: user.id });
        } catch (err) {
          logger.error("[Auth] Failed to create fallback membership:", err);
        }
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
