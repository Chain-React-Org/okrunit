// ---------------------------------------------------------------------------
// OKrunit -- OAuth Client Secret Rotation
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateClientCredentials } from "@/lib/api/oauth";
import { logger } from "@/lib/monitoring/logger";

// ---- POST /api/v1/oauth/clients/[id]/rotate-secret -----------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage OAuth clients");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Verify the client belongs to this org.
    const { data: existing } = await admin
      .from("oauth_clients")
      .select("id, name, client_id, client_secret_prefix")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!existing) {
      throw new ApiError(404, "OAuth client not found");
    }

    // Generate a new secret (keep the same client_id).
    const { clientSecret, clientSecretHash, clientSecretPrefix } =
      generateClientCredentials();

    const { error } = await admin
      .from("oauth_clients")
      .update({
        client_secret_hash: clientSecretHash,
        client_secret_prefix: clientSecretPrefix,
      })
      .eq("id", id);

    if (error) {
      logger.error("[OAuth Clients] Failed to rotate secret:", error);
      throw new ApiError(500, "Failed to rotate client secret");
    }

    // Revoke all existing access and refresh tokens for this client.
    await admin
      .from("oauth_access_tokens")
      .delete()
      .eq("client_id", existing.client_id);

    await admin
      .from("oauth_refresh_tokens")
      .delete()
      .eq("client_id", existing.client_id);

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "oauth.client_secret_rotated",
      resourceType: "oauth_client",
      resourceId: id,
      details: {
        name: existing.name,
        client_id: existing.client_id,
        old_prefix: existing.client_secret_prefix,
        new_prefix: clientSecretPrefix,
      },
      ipAddress,
    });

    return NextResponse.json({
      data: {
        client_id: existing.client_id,
        client_secret_prefix: clientSecretPrefix,
      },
      client_secret: clientSecret,
      client_secret_warning:
        "Store this secret securely. It will not be shown again. All existing tokens have been revoked.",
    });
  } catch (err) {
    return errorResponse(err);
  }
}
