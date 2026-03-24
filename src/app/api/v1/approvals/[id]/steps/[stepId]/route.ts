import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { recordStepVote } from "@/lib/approvals/steps-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { z } from "zod";

const VoteSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().max(5000).optional(),
});

/** PATCH /api/v1/approvals/[id]/steps/[stepId] — Vote on a step */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stepId: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, stepId } = await params;
  const { profile, membership } = ctx;

  // Verify approval belongs to org
  const admin = createAdminClient();
  const { data: approval } = await admin
    .from("approval_requests")
    .select("id, org_id, status, has_steps")
    .eq("id", id)
    .eq("org_id", membership.org_id)
    .single();

  if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  if (approval.status !== "pending") return NextResponse.json({ error: "Approval is no longer pending" }, { status: 400 });
  if (!approval.has_steps) return NextResponse.json({ error: "This approval does not use steps" }, { status: 400 });

  if (!(membership.can_approve ?? true)) {
    return NextResponse.json({ error: "You do not have approval permissions" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = VoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid vote", details: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await recordStepVote(
      stepId,
      id,
      profile.id,
      parsed.data.decision,
      parsed.data.comment,
      "dashboard",
    );

    // Audit log
    await logAuditEvent({
      orgId: membership.org_id,
      userId: profile.id,
      action: `step_${parsed.data.decision}`,
      resourceType: "approval_step",
      resourceId: stepId,
      details: {
        request_id: id,
        step_complete: result.stepComplete,
        all_steps_complete: result.allStepsComplete,
        request_approved: result.requestApproved,
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record vote";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
