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
    const userRole = auth.membership.role;

    // 3. Load the set of teams this user leads. Team leads can archive
    //    requests assigned to their team.
    const { data: leadRows } = await admin
      .from("team_memberships")
      .select("team_id, teams!inner(org_id)")
      .eq("user_id", actorId)
      .eq("is_lead", true)
      .eq("teams.org_id", auth.orgId);
    const leadTeamIds = new Set(
      (leadRows ?? []).map((r: { team_id: string }) => r.team_id),
    );

    // 4. Fetch the candidate approvals with just enough to decide
    //    permission (created_by + assigned_team_id), then silently drop
    //    any the user isn't allowed to touch. Matches UI behavior — the
    //    Archive button is already hidden for those requests, so the
    //    only way to reach this path for a forbidden id is a direct
    //    API call.
    const { data: candidates, error: fetchError } = await admin
      .from("approval_requests")
      .select("id, created_by, assigned_team_id")
      .in("id", validated.ids)
      .eq("org_id", auth.orgId);

    if (fetchError) {
      throw new ApiError(500, "Failed to fetch approvals", "FETCH_FAILED");
    }

    const allowedIds: string[] = [];
    for (const c of candidates ?? []) {
      const approvalLike = {
        created_by: c.created_by as CreatedByInfo | null,
        assigned_team_id: c.assigned_team_id as string | null,
      };
      if (canArchiveApproval(approvalLike, actorId, userRole, leadTeamIds)) {
        allowedIds.push(c.id);
      }
    }

    // 5. Update only the allowed ones.
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

    // 6. Audit log
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

    return NextResponse.json({ processed: updated.length, errors: [] });
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
