// ---------------------------------------------------------------------------
// OKrunit -- Push Subscribe API: POST (store push subscription)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- Validation Schema -----------------------------------------------------

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// ---- POST /api/v1/push/subscribe ------------------------------------------

export async function POST(request: Request) {
  try {
    // 1. Authenticate -- session only (push is a user-facing feature)
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
    const validated = subscribeSchema.parse(body);

    // 3. Upsert the push subscription (unique by endpoint)
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("push_subscriptions")
      .select("id")
      .eq("endpoint", validated.endpoint)
      .maybeSingle();

    if (existing) {
      // Update the existing subscription (keys may have rotated)
      const { error: updateError } = await admin
        .from("push_subscriptions")
        .update({
          user_id: auth.user.id,
          p256dh: validated.keys.p256dh,
          auth: validated.keys.auth,
        })
        .eq("id", existing.id);

      if (updateError) {
        logger.error("[Push] Failed to update subscription:", updateError);
        throw new ApiError(500, "Failed to update push subscription");
      }
    } else {
      // Insert a new subscription
      const { error: insertError } = await admin
        .from("push_subscriptions")
        .insert({
          user_id: auth.user.id,
          endpoint: validated.endpoint,
          p256dh: validated.keys.p256dh,
          auth: validated.keys.auth,
        });

      if (insertError) {
        logger.error("[Push] Failed to store subscription:", insertError);
        throw new ApiError(500, "Failed to store push subscription");
      }
    }

    return NextResponse.json(
      { message: "Push subscription stored" },
      { status: 201 },
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
