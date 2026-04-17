// ---------------------------------------------------------------------------
// OKrunit -- Bulk Approval Rules API: List + Create
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createBulkRuleSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { canUseFeature } from "@/lib/billing/enforce";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- GET /api/v1/bulk-rules -----------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage bulk rules");
    }

    const admin = createAdminClient();

    const { data: rules, error } = await admin
      .from("bulk_approval_rules")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("[BulkRules] Failed to list rules:", error);
      throw new ApiError(500, "Failed to list bulk rules");
    }

    return NextResponse.json({ data: rules });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- POST /api/v1/bulk-rules ----------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage bulk rules");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const featureCheck = await canUseFeature(auth.orgId, "rules_engine");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "Bulk rules require a Pro plan or higher", "PLAN_LIMIT_EXCEEDED");
    }

    let body: z.infer<typeof createBulkRuleSchema>;
    try {
      body = createBulkRuleSchema.parse(await request.json());
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

    const { data: rule, error } = await admin
      .from("bulk_approval_rules")
      .insert({
        org_id: auth.orgId,
        name: body.name,
        description: body.description ?? null,
        action: body.action,
        status_filter: body.status_filter ?? "pending",
        priority_filter: body.priority_filter ?? null,
        source_filter: body.source_filter ?? null,
        action_type_filter: body.action_type_filter ?? null,
        older_than_minutes: body.older_than_minutes ?? null,
        is_scheduled: body.is_scheduled ?? false,
        schedule_cron: body.schedule_cron ?? null,
        is_active: body.is_active ?? true,
        created_by: auth.user.id,
      })
      .select("*")
      .single();

    if (error || !rule) {
      logger.error("[BulkRules] Failed to create rule:", error);
      throw new ApiError(500, "Failed to create bulk rule");
    }

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "bulk_rule.created",
      resourceType: "bulk_approval_rule",
      resourceId: rule.id,
      details: { name: body.name, action: body.action },
      ipAddress: getIpAddress(request),
    });

    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
