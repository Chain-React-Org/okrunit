// ---------------------------------------------------------------------------
// OKrunit -- OAuth Grants API: Revoke an OAuth connection
// DELETE /api/v1/oauth/grants/[clientId]
// ---------------------------------------------------------------------------
// Revokes ALL access tokens and refresh tokens for the given OAuth client
// within the current organization. After revocation, the external app (e.g.
// Zapier) will receive an error on its next token refresh and show as
// disconnected.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- DELETE /api/v1/oauth/grants/[clientId] ---------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ clientId: string }> },
) {
  try {
    const { clientId } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can revoke connected apps",
      );
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    // Revoke all refresh tokens for this client in this org.
    const { data: revokedRefresh, error: refreshError } = await admin
      .from("oauth_refresh_tokens")
      .update({ revoked_at: now })
      .eq("client_id", clientId)
      .eq("org_id", auth.orgId)
      .is("revoked_at", null)
      .select("id");

    // Revoke all access tokens for this client in this org.
    const { data: revokedAccess, error: accessError } = await admin
      .from("oauth_access_tokens")
      .update({ revoked_at: now })
      .eq("client_id", clientId)
      .eq("org_id", auth.orgId)
      .is("revoked_at", null)
      .select("id");

    if (refreshError || accessError) {
      logger.error(
        "[OAuth Grants] Revoke error:",
        refreshError,
        accessError,
      );
      throw new ApiError(500, "Failed to revoke OAuth grant");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "oauth.grant_revoked",
      resourceType: "oauth_grant",
      resourceId: clientId,
      details: {
        client_id: clientId,
        revoked_refresh_tokens: revokedRefresh?.length ?? 0,
        revoked_access_tokens: revokedAccess?.length ?? 0,
      },
      ipAddress,
    });

    return NextResponse.json({
      data: {
        client_id: clientId,
        revoked_refresh_tokens: revokedRefresh?.length ?? 0,
        revoked_access_tokens: revokedAccess?.length ?? 0,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
