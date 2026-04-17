// ---------------------------------------------------------------------------
// OKrunit -- Admin Plan Override API
// PATCH: Set or clear plan_override on an organization.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { getAppAdminContext } from "@/lib/app-admin";
import { logger } from "@/lib/monitoring/logger";

const bodySchema = z.object({
  org_id: z.string().uuid("Invalid org ID"),
  plan_override: z.enum(["free", "pro", "business", "enterprise"]).nullable(),
});

export async function PATCH(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      throw new ApiError(403, "App admin access required", "APP_ADMIN_REQUIRED");
    }

    const admin = createAdminClient();

    let body: z.infer<typeof bodySchema>;
    try {
      body = bodySchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // Verify the org exists
    const { data: org } = await admin
      .from("organizations")
      .select("id, name, plan_override")
      .eq("id", body.org_id)
      .single();

    if (!org) {
      throw new ApiError(404, "Organization not found");
    }

    // Update plan_override
    const { error: updateError } = await admin
      .from("organizations")
      .update({ plan_override: body.plan_override })
      .eq("id", body.org_id);

    if (updateError) {
      logger.error("[Admin] Failed to update plan override:", updateError);
      throw new ApiError(500, "Failed to update plan override");
    }

    return NextResponse.json({
      data: {
        org_id: body.org_id,
        org_name: org.name,
        plan_override: body.plan_override,
        previous_override: org.plan_override,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
