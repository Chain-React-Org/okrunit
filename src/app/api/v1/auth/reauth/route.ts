// ---------------------------------------------------------------------------
// OKrunit -- Re-authentication Endpoint
// POST /api/v1/auth/reauth
// Verifies user password and records a fresh re-authentication timestamp.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { checkIpRateLimit, getClientIp, AUTH_RATE_LIMIT, rateLimitResponse } from "@/lib/api/ip-rate-limiter";
import { logger } from "@/lib/monitoring/logger";

// ---- Validation -----------------------------------------------------------

const reauthSchema = z.object({
  password: z.string().min(1, "Password is required"),
});

// ---- POST /api/v1/auth/reauth ---------------------------------------------

export async function POST(request: Request) {
  // Rate limit: 10 attempts per minute per IP (brute-force protection)
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`reauth:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    // 1. Authenticate -- session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can re-authenticate",
        "SESSION_REQUIRED",
      );
    }

    // 2. Validate body
    let body: z.infer<typeof reauthSchema>;
    try {
      body = reauthSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // 3. Verify password by attempting a sign-in with Supabase Auth
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: auth.user.email,
      password: body.password,
    });

    if (signInError) {
      const ipAddress =
        request.headers.get("x-forwarded-for") ??
        request.headers.get("x-real-ip") ??
        "unknown";

      logAuditEvent({
        orgId: auth.orgId,
        userId: auth.user.id,
        action: "security.reauth_failed",
        resourceType: "user",
        resourceId: auth.user.id,
        details: { reason: "invalid_password" },
        ipAddress,
      });

      throw new ApiError(401, "Invalid password", "INVALID_PASSWORD");
    }

    // 4. Record the re-authentication timestamp in user metadata
    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { error: updateError } = await admin.auth.admin.updateUserById(
      auth.user.id,
      {
        user_metadata: {
          last_reauth_at: now,
        },
      },
    );

    if (updateError) {
      logger.error("[Reauth] Failed to update user metadata:", updateError);
      throw new ApiError(500, "Failed to record re-authentication");
    }

    // 5. Audit log
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "security.reauth_success",
      resourceType: "user",
      resourceId: auth.user.id,
      ipAddress,
    });

    return NextResponse.json({
      success: true,
      last_reauth_at: now,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
