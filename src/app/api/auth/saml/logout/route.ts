// ---------------------------------------------------------------------------
// OKrunit -- SAML Single Logout (SLO)
// ---------------------------------------------------------------------------
// GET  /api/auth/saml/logout  - SP-initiated logout
// POST /api/auth/saml/logout  - IdP-initiated logout
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { findSSOConfigByEmail, APP_URL } from "@/lib/saml/provider";
import { logger } from "@/lib/monitoring/logger";

/**
 * Creates a read-only Supabase client from the request cookies to read
 * the current user session.
 */
async function getSessionUser() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        // We only need to read cookies here, not set them
        setAll() {},
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ---- GET: SP-initiated logout ------------------------------------------------

export async function GET() {
  try {
    const user = await getSessionUser();

    if (!user?.email) {
      // No session, just redirect to login
      return NextResponse.redirect(new URL("/login", APP_URL));
    }

    // Find the SSO config for this user's email domain
    const config = await findSSOConfigByEmail(user.email);

    // Sign out the Supabase session via admin API
    const admin = createAdminClient();
    await admin.auth.admin.signOut(user.id);

    // If the config has an SLO URL, redirect to the IdP's SLO endpoint
    if (config?.slo_url) {
      // Simple redirect to IdP SLO. The IdP will handle the logout
      const sloUrl = new URL(config.slo_url);
      sloUrl.searchParams.set("RelayState", `${APP_URL}/login`);
      return NextResponse.redirect(sloUrl.toString());
    }

    // No SLO URL configured, just redirect to login
    return NextResponse.redirect(new URL("/login", APP_URL));
  } catch (err) {
    logger.error("[SAML SLO] SP-initiated logout error:", err);
    return NextResponse.redirect(new URL("/login", APP_URL));
  }
}

// ---- POST: IdP-initiated logout ----------------------------------------------

export async function POST(request: NextRequest) {
  try {
    // IdP-initiated logout sends a SAMLRequest or LogoutResponse
    // For simplicity, we sign out the user and redirect to login
    const formData = await request.formData();
    const relayState = formData.get("RelayState") as string | null;

    // Try to identify the user from the session and sign them out
    const user = await getSessionUser();
    if (user) {
      const admin = createAdminClient();
      await admin.auth.admin.signOut(user.id);
    }

    // Redirect to RelayState if it's a safe relative path, otherwise /login
    let redirectPath = "/login";
    if (relayState && relayState.startsWith("/") && !relayState.startsWith("//")) {
      redirectPath = relayState;
    }

    return NextResponse.redirect(new URL(redirectPath, APP_URL));
  } catch (err) {
    logger.error("[SAML SLO] IdP-initiated logout error:", err);
    return NextResponse.redirect(new URL("/login", APP_URL));
  }
}
