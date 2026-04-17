// ---------------------------------------------------------------------------
// OKrunit -- OAuth 2.0 Token Revocation (RFC 7009)
// POST /api/v1/oauth/revoke
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { hashApiKey } from "@/lib/api/auth";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- POST /api/v1/oauth/revoke ---------------------------------------------

export async function POST(request: Request) {
  try {
    // Accept form-encoded or JSON.
    let body: Record<string, string>;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries()) as Record<string, string>;
    } else {
      body = await request.json();
    }

    const { token, token_type_hint } = body;

    if (!token) {
      return NextResponse.json(
        { error: "invalid_request", error_description: "Missing token parameter." },
        { status: 400 },
      );
    }

    const tokenHash = hashApiKey(token);
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    // Try access token first (or as hinted).
    if (!token_type_hint || token_type_hint === "access_token") {
      const { data: accessToken } = await admin
        .from("oauth_access_tokens")
        .select("id, client_id, user_id, org_id, revoked_at")
        .eq("token_hash", tokenHash)
        .single();

      if (accessToken && !accessToken.revoked_at) {
        await admin
          .from("oauth_access_tokens")
          .update({ revoked_at: now })
          .eq("id", accessToken.id);

        await logAuditEvent({
          orgId: accessToken.org_id,
          userId: accessToken.user_id,
          action: "oauth.token_revoked",
          resourceType: "oauth_access_token",
          resourceId: accessToken.id,
          details: { client_id: accessToken.client_id },
          ipAddress,
        });

        // Per RFC 7009, always return 200.
        return NextResponse.json({});
      }
    }

    // Try refresh token.
    if (!token_type_hint || token_type_hint === "refresh_token") {
      const { data: refreshToken } = await admin
        .from("oauth_refresh_tokens")
        .select("id, client_id, user_id, org_id, revoked_at")
        .eq("token_hash", tokenHash)
        .single();

      if (refreshToken && !refreshToken.revoked_at) {
        // Revoke the refresh token.
        await admin
          .from("oauth_refresh_tokens")
          .update({ revoked_at: now })
          .eq("id", refreshToken.id);

        // Also revoke all access tokens for this client + user.
        await admin
          .from("oauth_access_tokens")
          .update({ revoked_at: now })
          .eq("client_id", refreshToken.client_id)
          .eq("user_id", refreshToken.user_id)
          .is("revoked_at", null);

        await logAuditEvent({
          orgId: refreshToken.org_id,
          userId: refreshToken.user_id,
          action: "oauth.token_revoked",
          resourceType: "oauth_refresh_token",
          resourceId: refreshToken.id,
          details: { client_id: refreshToken.client_id, cascade: true },
          ipAddress,
        });

        return NextResponse.json({});
      }
    }

    // Per RFC 7009, return 200 even if token not found.
    return NextResponse.json({});
  } catch (err) {
    logger.error("[OAuth Revoke] Unhandled error:", err);
    return NextResponse.json(
      { error: "server_error", error_description: "An unexpected error occurred." },
      { status: 500 },
    );
  }
}
