// ---------------------------------------------------------------------------
// OKrunit -- Push Unsubscribe API: POST (remove push subscription)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- Validation Schema -----------------------------------------------------

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

// ---- POST /api/v1/push/unsubscribe ----------------------------------------

export async function POST(request: Request) {
  try {
    // 1. Authenticate -- session only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Push subscriptions require session authentication",
        "SESSION_REQUIRED",
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const validated = unsubscribeSchema.parse(body);

    // 3. Delete the subscription (scoped to user_id for safety)
    const admin = createAdminClient();

    const { error: deleteError } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("endpoint", validated.endpoint)
      .eq("user_id", auth.user.id);

    if (deleteError) {
      logger.error("[Push] Failed to delete subscription:", deleteError);
      throw new ApiError(500, "Failed to remove push subscription");
    }

    return NextResponse.json(
      { message: "Push subscription removed" },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    return errorResponse(error);
  }
}
