// ---------------------------------------------------------------------------
// OKrunit -- Approval Conditions API: GET (list) + POST (add condition)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createConditionSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAndCheckUrl } from "@/lib/api/ssrf";
import { logger } from "@/lib/monitoring/logger";

// ---- GET /api/v1/approvals/[id]/conditions --------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Authenticate
    const auth = await authenticateRequest(request);
    const admin = createAdminClient();

    // 2. Verify approval exists and belongs to org
    const { data: approval, error: approvalError } = await admin
      .from("approval_requests")
      .select("id, org_id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (approvalError || !approval) {
      throw new ApiError(404, "Approval request not found", "NOT_FOUND");
    }

    // 3. Fetch conditions
    const { data: conditions, error } = await admin
      .from("approval_conditions")
      .select("*")
      .eq("request_id", id)
      .order("created_at", { ascending: true });

    if (error) {
      logger.error("[Conditions] Fetch failed:", error);
      throw new ApiError(500, "Failed to fetch conditions");
    }

    return NextResponse.json({ data: conditions ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---- POST /api/v1/approvals/[id]/conditions -------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // 1. Authenticate -- session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can add conditions",
        "SESSION_REQUIRED",
      );
    }

    const admin = createAdminClient();

    // 2. Fetch approval
    const { data: approval, error: approvalError } = await admin
      .from("approval_requests")
      .select("id, org_id, status")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (approvalError || !approval) {
      throw new ApiError(404, "Approval request not found", "NOT_FOUND");
    }

    // 3. Only allow adding conditions to pending approvals
    if (approval.status !== "pending") {
      throw new ApiError(
        409,
        "Can only add conditions to pending approvals",
        "NOT_PENDING",
      );
    }

    // 4. Validate body
    const body = await request.json();
    const validated = createConditionSchema.parse(body);

    // 5. Validate webhook_url is provided for webhook check type
    if (validated.check_type === "webhook" && !validated.webhook_url) {
      throw new ApiError(
        400,
        "webhook_url is required for webhook check type",
        "WEBHOOK_URL_REQUIRED",
      );
    }

    // 6. SSRF check on webhook URL
    if (validated.webhook_url) {
      const isPrivate = await resolveAndCheckUrl(validated.webhook_url);
      if (isPrivate) {
        throw new ApiError(400, "Invalid webhook URL: targets a private or reserved network");
      }
    }

    // 7. Insert condition
    const { data: condition, error: insertError } = await admin
      .from("approval_conditions")
      .insert({
        request_id: id,
        name: validated.name,
        description: validated.description ?? null,
        check_type: validated.check_type,
        webhook_url: validated.webhook_url ?? null,
      })
      .select("*")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        throw new ApiError(
          409,
          "A condition with this name already exists for this approval",
          "DUPLICATE_CONDITION",
        );
      }
      logger.error("[Conditions] Insert failed:", insertError);
      throw new ApiError(500, "Failed to add condition");
    }

    // 7. Update conditions_met to false since we added a new pending condition
    await admin
      .from("approval_requests")
      .update({ conditions_met: false })
      .eq("id", id);

    // 8. Audit log
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "condition.created",
      resourceType: "approval_condition",
      resourceId: condition.id,
      details: {
        request_id: id,
        name: validated.name,
        check_type: validated.check_type,
      },
      ipAddress,
    });

    return NextResponse.json(condition, { status: 201 });
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
