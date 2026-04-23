// ---------------------------------------------------------------------------
// OKrunit -- Consume a messaging link nonce
// ---------------------------------------------------------------------------
// POST /api/v1/messaging/identities/consume
// Body: { nonce: string }
//
// Bound to the /link landing page's "Confirm" button. Links the signed-in
// OKrunit user to the platform identity encoded in the nonce. Runs inside
// a session-auth check so nobody can consume someone else's nonce anonymously.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { consumeLinkNonce } from "@/lib/messaging/link-nonces";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
      throw new ApiError(403, "Session authentication required", "SESSION_REQUIRED");
    }

    const body = (await request.json().catch(() => ({}))) as { nonce?: string };
    if (!body.nonce) {
      throw new ApiError(400, "Missing nonce", "MISSING_NONCE");
    }

    const result = await consumeLinkNonce({
      nonce: body.nonce,
      okrunitUserId: auth.user.id,
    });

    if (!result.ok) {
      const status =
        result.code === "NOT_FOUND"
          ? 404
          : result.code === "EXPIRED"
            ? 410
            : result.code === "ALREADY_CONSUMED"
              ? 409
              : result.code === "NOT_ORG_MEMBER"
                ? 403
                : 500;
      return NextResponse.json({ error: result.code }, { status });
    }

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "messaging_identity.linked",
      resourceType: "messaging_user_identity",
      details: {
        platform: result.platform,
        external_user_id: result.externalUserId,
        external_username: result.externalUsername,
      },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      ok: true,
      platform: result.platform,
      externalUsername: result.externalUsername,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
