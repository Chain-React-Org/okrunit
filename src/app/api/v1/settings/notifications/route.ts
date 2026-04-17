// ---------------------------------------------------------------------------
// OKRunit -- Notification Settings API: GET + PUT
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

const updateSchema = z.object({
  email_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
  quiet_hours_enabled: z.boolean().optional(),
  quiet_hours_start: z.string().nullable().optional(),
  quiet_hours_end: z.string().nullable().optional(),
  quiet_hours_timezone: z.string().nullable().optional(),
  quiet_hours_schedule: z.record(z.string(), z.object({ start: z.string(), end: z.string() }).nullable()).nullable().optional(),
  minimum_priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  skip_approval_confirmation: z.boolean().optional(),
  dashboard_layout: z.enum(["cards", "grouped", "split"]).optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from("notification_settings")
      .select("*")
      .eq("user_id", auth.user.id)
      .maybeSingle();

    if (error) {
      logger.error("[Notification Settings] Failed to fetch:", error);
      throw new ApiError(500, "Failed to fetch notification settings");
    }

    return NextResponse.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    const body = await request.json();
    const validated = updateSchema.parse(body);

    const admin = createAdminClient();

    const payload = {
      user_id: auth.user.id,
      ...validated,
    };

    const { data, error } = await admin
      .from("notification_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      logger.error("[Notification Settings] Failed to save:", error);
      throw new ApiError(500, "Failed to save notification settings");
    }

    return NextResponse.json({ data });
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
