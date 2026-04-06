// ---------------------------------------------------------------------------
// OKrunit -- SSO Enforcement Check API
// ---------------------------------------------------------------------------
// POST /api/v1/auth/check-sso
//
// Checks whether an email domain requires SSO login (enforce_sso = true).
// Called before login to determine if the user should be redirected to SSO
// instead of using password-based authentication.
//
// No authentication required — this is called before login.
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

const checkSSOSchema = z.object({
  email: z.string().email("Must be a valid email address"),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = checkSSOSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid email", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const domain = email.split("@")[1];
    if (!domain) {
      return NextResponse.json({ enforce_sso: false });
    }

    const admin = createAdminClient();

    // Find orgs that have this SSO domain
    const { data: orgs } = await admin
      .from("organizations")
      .select("id")
      .eq("sso_domain", domain);

    if (!orgs || orgs.length === 0) {
      return NextResponse.json({ enforce_sso: false });
    }

    // Check if any of these orgs have an active SSO config with enforce_sso = true
    const orgIds = orgs.map((o) => o.id);
    const { data: ssoConfigs } = await admin
      .from("sso_configs")
      .select("enforce_sso")
      .in("org_id", orgIds)
      .eq("is_active", true)
      .eq("enforce_sso", true)
      .limit(1);

    if (ssoConfigs && ssoConfigs.length > 0) {
      return NextResponse.json({
        enforce_sso: true,
        login_url: `/api/auth/saml/login?email=${encodeURIComponent(email)}`,
      });
    }

    return NextResponse.json({ enforce_sso: false });
  } catch (err) {
    return errorResponse(err);
  }
}
