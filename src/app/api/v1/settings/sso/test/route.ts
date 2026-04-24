// ---------------------------------------------------------------------------
// OKrunit -- SSO Test Connection API
// ---------------------------------------------------------------------------
// POST /api/v1/settings/sso/test
//
// Tests the SSO configuration by attempting to generate a valid SAML
// AuthnRequest. Proves the SP/IdP config is valid without requiring an
// actual login round-trip.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import * as samlify from "samlify";

import { authenticateRequest, type AuthResult } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseFeature } from "@/lib/billing/enforce";
import { createServiceProvider, createIdentityProvider } from "@/lib/saml/provider";
import type { SSOConfig } from "@/lib/types/database";

function requireSessionAdmin(auth: AuthResult): {
  userId: string;
  orgId: string;
} {
  if (auth.type !== "session") {
    throw new ApiError(403, "SSO configuration requires dashboard session authentication");
  }
  if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
    throw new ApiError(403, "Only organization owners and admins can test SSO configuration");
  }
  return { userId: auth.user.id, orgId: auth.orgId };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    const { orgId } = requireSessionAdmin(auth);

    // Check feature access
    const featureCheck = await canUseFeature(orgId, "sso_saml");
    if (!featureCheck.allowed) {
      return NextResponse.json(
        {
          error: featureCheck.reason,
          code: "PLAN_LIMIT_EXCEEDED",
          upgrade_required: true,
          current_plan: featureCheck.plan,
        },
        { status: 403 },
      );
    }

    // Load the org's SSO config
    const admin = createAdminClient();
    const { data: config, error } = await admin
      .from("sso_configs")
      .select("*")
      .eq("org_id", orgId)
      .single<SSOConfig>();

    if (error || !config) {
      return NextResponse.json(
        { success: false, error: "No SSO configuration found. Please save a configuration first." },
        { status: 404 },
      );
    }

    // Attempt to generate a SAML AuthnRequest
    try {
      const sp = createServiceProvider();
      const idp = createIdentityProvider(config);

      const loginRequest = sp.createLoginRequest(
        idp,
        samlify.Constants.namespace.binding.redirect,
      );

      return NextResponse.json({
        success: true,
        login_url: loginRequest.context,
      });
    } catch (samlError) {
      const message =
        samlError instanceof Error ? samlError.message : "Unknown SAML error";
      return NextResponse.json({
        success: false,
        error: `SAML configuration test failed: ${message}`,
      });
    }
  } catch (err) {
    return errorResponse(err);
  }
}
