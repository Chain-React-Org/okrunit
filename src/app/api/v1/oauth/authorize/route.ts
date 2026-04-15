// ---------------------------------------------------------------------------
// OKrunit -- OAuth 2.0 Authorization Code Issuance
// POST /api/v1/oauth/authorize
// ---------------------------------------------------------------------------
// Called by the consent form to generate an authorization code and return the
// redirect URL. Requires an active Supabase session (the user must be logged in).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateOAuthToken, authCodeExpiresAt } from "@/lib/api/oauth";

const authorizeSchema = z.object({
  client_id: z.string().min(1),
  redirect_uri: z.string().url(),
  scopes: z.array(z.string()).min(1),
  state: z.string().optional().default(""),
  code_challenge: z.string().optional(),
  code_challenge_method: z.literal("S256").optional(),
});

export async function POST(request: Request) {
  try {
    // This endpoint requires a session. The user must be logged in.
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Authorization requires a dashboard session",
        "SESSION_REQUIRED",
      );
    }

    let body: z.infer<typeof authorizeSchema>;
    try {
      body = authorizeSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    const admin = createAdminClient();

    // Verify the client exists and is active.
    const { data: client } = await admin
      .from("oauth_clients")
      .select("client_id, redirect_uris, scopes, is_active")
      .eq("client_id", body.client_id)
      .single();

    if (!client || !client.is_active) {
      throw new ApiError(400, "Invalid or inactive client", "INVALID_CLIENT");
    }

    // Verify redirect_uri is registered.
    // Supports exact matches and wildcard patterns (e.g. "https://*.app.n8n.cloud/rest/oauth2-credential/callback")
    const uriMatch = client.redirect_uris.some((pattern: string) => {
      if (pattern.includes("*")) {
        const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]+");
        return new RegExp(`^${escaped}$`).test(body.redirect_uri);
      }
      return pattern === body.redirect_uri;
    });
    if (!uriMatch) {
      throw new ApiError(
        400,
        "Invalid redirect URI",
        "INVALID_REDIRECT_URI",
      );
    }

    // Generate the authorization code.
    const code = generateOAuthToken();

    await admin.from("oauth_authorization_codes").insert({
      client_id: body.client_id,
      user_id: auth.user.id,
      org_id: auth.orgId,
      code_hash: code.hash,
      redirect_uri: body.redirect_uri,
      scopes: body.scopes,
      code_challenge: body.code_challenge ?? null,
      code_challenge_method: body.code_challenge_method ?? null,
      expires_at: authCodeExpiresAt(),
    });

    // Build the redirect URL.
    const redirectUrl = new URL(body.redirect_uri);
    redirectUrl.searchParams.set("code", code.plaintext);
    if (body.state) {
      redirectUrl.searchParams.set("state", body.state);
    }

    // Audit log.
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "oauth.code_issued",
      resourceType: "oauth_authorization_code",
      details: { client_id: body.client_id },
      ipAddress,
    });

    return NextResponse.json({ redirect_url: redirectUrl.toString() });
  } catch (err) {
    return errorResponse(err);
  }
}
