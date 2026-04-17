// ---------------------------------------------------------------------------
// OKrunit -- SAML Login Initiator
// ---------------------------------------------------------------------------
// GET /api/auth/saml/login?email=user@company.com
//
// Looks up the SSO config for the user's email domain, creates a SAML
// AuthnRequest, and redirects to the IdP's SSO URL.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import {
  createServiceProvider,
  createIdentityProvider,
  findSSOConfigByEmail,
} from "@/lib/saml/provider";
import { logger } from "@/lib/monitoring/logger";
export async function GET(request: NextRequest) {
  try {
    const email = request.nextUrl.searchParams.get("email");
    const redirectTo = request.nextUrl.searchParams.get("redirect_to");

    if (!email) {
      return NextResponse.redirect(
        new URL("/login?error=sso_email_required", request.url),
      );
    }

    const config = await findSSOConfigByEmail(email);

    if (!config) {
      return NextResponse.redirect(
        new URL("/login?error=sso_not_configured", request.url),
      );
    }


    const sp = createServiceProvider();
    const idp = createIdentityProvider(config);

    const loginRequest = sp.createLoginRequest(idp, "redirect");

    // loginRequest has { id, context } where context is the redirect URL
    let redirectUrl = loginRequest.context;

    // Append RelayState for deep linking if redirect_to is a safe relative path
    if (redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")) {
      const separator = redirectUrl.includes("?") ? "&" : "?";
      redirectUrl = `${redirectUrl}${separator}RelayState=${encodeURIComponent(redirectTo)}`;
    }

    return NextResponse.redirect(redirectUrl);
  } catch (err) {
    logger.error("[SAML Login] Error:", err);
    return NextResponse.redirect(
      new URL("/login?error=sso_failed", request.url),
    );
  }
}
