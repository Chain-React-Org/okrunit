// ---------------------------------------------------------------------------
// OKrunit -- SAML Assertion Consumer Service (ACS)
// ---------------------------------------------------------------------------
// POST /api/auth/saml/callback
//
// Receives the SAML Response from the IdP after the user authenticates.
// Validates the assertion signature, extracts user attributes, provisions
// the user in Supabase if needed, creates a session, and redirects.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import * as samlify from "samlify";
import { createAdminClient } from "@/lib/supabase/admin";

import {
  createServiceProvider,
  createIdentityProvider,
  APP_URL,
} from "@/lib/saml/provider";
import type { SSOConfig } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const samlResponse = formData.get("SAMLResponse") as string | null;

    if (!samlResponse) {
      return NextResponse.redirect(
        new URL("/login?error=saml_response_missing", APP_URL),
      );
    }

    // We need to find which org's SSO config to validate against.
    // The RelayState or the response itself may carry this info.
    // We'll try all active SSO configs — in practice there's usually one match.
    const admin = createAdminClient();
    const { data: configs } = await admin
      .from("sso_configs")
      .select("*, organizations!inner(id, sso_domain)")
      .eq("is_active", true)
      .returns<(SSOConfig & { organizations: { id: string; sso_domain: string | null } })[]>();

    if (!configs || configs.length === 0) {
      return NextResponse.redirect(
        new URL("/login?error=sso_not_configured", APP_URL),
      );
    }

    // Try to parse the assertion against each active IdP config
    let parsedResult: { extract: Record<string, unknown> } | null = null;
    let matchedConfig: (typeof configs)[number] | null = null;

    const sp = createServiceProvider();

    for (const config of configs) {
      try {
        const idp = createIdentityProvider(config);
        const result = await sp.parseLoginResponse(
          idp,
          samlify.Constants.namespace.binding.post,
          { body: { SAMLResponse: samlResponse } },
        );

        if (result?.extract) {
          parsedResult = result;
          matchedConfig = config;
          break;
        }
      } catch {
        // This config didn't match — try next
        continue;
      }
    }

    if (!parsedResult || !matchedConfig) {
      console.error("[SAML] No matching SSO config validated the assertion");
      return NextResponse.redirect(
        new URL("/login?error=saml_validation_failed", APP_URL),
      );
    }

    // Extract user attributes from the assertion
    const extract = parsedResult.extract;
    const attributes = (extract.attributes as Record<string, string>) || {};
    const attrMapping = matchedConfig.attribute_mapping || {};

    // Try to get email from: nameID, mapped attribute, or common attribute names
    const nameID = extract.nameID as string | undefined;
    const email = (
      nameID ||
      attributes[attrMapping.email || "email"] ||
      attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"] ||
      attributes["User.Email"] ||
      attributes["email"]
    )?.toLowerCase();

    if (!email || !email.includes("@")) {
      console.error("[SAML] No email found in assertion", { nameID, attributes });
      return NextResponse.redirect(
        new URL("/login?error=saml_no_email", APP_URL),
      );
    }

    const firstName =
      attributes[attrMapping.firstName || "firstName"] ||
      attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname"] ||
      attributes["User.FirstName"] ||
      "";

    const lastName =
      attributes[attrMapping.lastName || "lastName"] ||
      attributes["http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname"] ||
      attributes["User.LastName"] ||
      "";

    const fullName = [firstName, lastName].filter(Boolean).join(" ") || email.split("@")[0];

    const orgId = matchedConfig.org_id;

    // Provision or find the user in Supabase
    // 1. Check if user exists by email
    const { data: existingUsers } = await admin.auth.admin.listUsers();
    const existingUser = existingUsers?.users.find(
      (u) => u.email?.toLowerCase() === email,
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;

      // Update name if it changed
      if (fullName && fullName !== existingUser.user_metadata?.full_name) {
        await admin.auth.admin.updateUserById(userId, {
          user_metadata: {
            ...existingUser.user_metadata,
            full_name: fullName,
            sso_provider: "saml",
          },
        });
      }
    } else {
      // Create new user — generate a random password since they'll use SSO
      const randomPassword = crypto.randomUUID() + crypto.randomUUID();
      const { data: newUser, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password: randomPassword,
          email_confirm: true, // SSO users are pre-verified
          user_metadata: {
            full_name: fullName,
            sso_provider: "saml",
          },
        });

      if (createError || !newUser?.user) {
        console.error("[SAML] Failed to create user:", createError);
        return NextResponse.redirect(
          new URL("/login?error=saml_user_creation_failed", APP_URL),
        );
      }

      userId = newUser.user.id;

      // Create user profile
      await admin.from("user_profiles").upsert({
        id: userId,
        email,
        full_name: fullName,
      });
    }

    // Ensure org membership exists
    const { data: membership } = await admin
      .from("org_memberships")
      .select("id")
      .eq("user_id", userId)
      .eq("org_id", orgId)
      .single();

    if (!membership) {
      await admin.from("org_memberships").insert({
        user_id: userId,
        org_id: orgId,
        role: "member",
      });
    }

    // Generate a magic link to sign the user in (creates a Supabase session)
    const { data: linkData, error: linkError } =
      await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: {
          redirectTo: `${APP_URL}/org/overview`,
        },
      });

    if (linkError || !linkData) {
      console.error("[SAML] Failed to generate magic link:", linkError);
      return NextResponse.redirect(
        new URL("/login?error=saml_session_failed", APP_URL),
      );
    }

    // Extract the token from the generated link and redirect through the
    // Supabase auth callback to establish the session cookie.
    const linkUrl = new URL(linkData.properties.action_link);
    const token = linkUrl.searchParams.get("token");
    const type = linkUrl.searchParams.get("type");

    if (!token) {
      console.error("[SAML] Magic link missing token");
      return NextResponse.redirect(
        new URL("/login?error=saml_session_failed", APP_URL),
      );
    }

    // Redirect to Supabase's verify endpoint which will set the session cookie
    // and then redirect to /org/overview
    const verifyUrl = new URL(
      `/auth/v1/verify?token=${token}&type=${type || "magiclink"}&redirect_to=${encodeURIComponent(`${APP_URL}/org/overview`)}`,
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    );

    return NextResponse.redirect(verifyUrl.toString());
  } catch (err) {
    console.error("[SAML] Callback error:", err);
    return NextResponse.redirect(
      new URL("/login?error=saml_error", APP_URL),
    );
  }
}
