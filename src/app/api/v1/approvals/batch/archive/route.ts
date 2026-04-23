// ---------------------------------------------------------------------------
// OKrunit -- Batch Archive API: POST (archive/unarchive)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { batchArchiveSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { canArchiveApproval } from "@/lib/approvals/archive";
import type { CreatedByInfo } from "@/lib/types/database";

// ---- Helpers --------------------------------------------------------------

function getIpAddress(request: Request): string {
  return (
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ---- POST /api/v1/approvals/batch/archive --------------------------------

export async function POST(request: Request) {
  try {
    // 1. Authenticate -- session only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can archive approvals",
        "SESSION_REQUIRED",
      );
    }

    const actorId = auth.user.id;

    // 2. Validate body
    const body = await request.json();
    const validated = batchArchiveSchema.parse(body);

    const admin = createAdminClient();
    const ipAddress = getIpAddress(request);
    const isArchiving = validated.action === "archive";
    const archivedAt = isArchiving ? new Date().toISOString() : null;

    // 3. Fetch the candidate approvals with their created_by so we can
    //    filter to the ones this user is actually allowed to archive.
    //    Rule: admins/owners can archive anything; everyone else can
    //    only archive requests they personally created (mere approvers
    //    can't archive, even if they're on the chain).
    const { data: candidates, error: fetchError } = await admin
      .from("approval_requests")
      .select("id, created_by")
      .in("id", validated.ids)
      .eq("org_id", auth.orgId);

    if (fetchError) {
      throw new ApiError(500, "Failed to fetch approvals", "FETCH_FAILED");
    }

    const userRole = auth.membership.role;
    const allowedIds: string[] = [];
    const forbiddenIds: string[] = [];
    for (const c of candidates ?? []) {
      const approvalLike = { created_by: c.created_by as CreatedByInfo | null };
      if (canArchiveApproval(approvalLike, actorId, userRole)) {
        allowedIds.push(c.id);
      } else {
        forbiddenIds.push(c.id);
      }
    }

    // 4. Update only the allowed ones.
    let updated: { id: string }[] = [];
    if (allowedIds.length > 0) {
      const { data, error: updateError } = await admin
        .from("approval_requests")
        .update({ archived_at: archivedAt })
        .in("id", allowedIds)
        .eq("org_id", auth.orgId)
        .select("id");

      if (updateError) {
        throw new ApiError(500, "Failed to update approvals", "UPDATE_FAILED");
      }
      updated = data ?? [];
    }

    const processed = updated.length;
    const errors = forbiddenIds.map((id) => ({
      id,
      error:
        "You can't archive this request. Only the creator or an admin can archive.",
      code: "FORBIDDEN",
    }));

    // 5. Audit log
    for (const row of updated) {
      logAuditEvent({
        orgId: auth.orgId,
        userId: actorId,
        action: isArchiving ? "approval.archived" : "approval.unarchived",
        resourceType: "approval_request",
        resourceId: row.id,
        details: { action: validated.action },
        ipAddress,
      });
    }

    return NextResponse.json({ processed, errors });
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
