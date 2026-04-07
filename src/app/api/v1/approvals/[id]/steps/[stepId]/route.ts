import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { recordStepVote } from "@/lib/approvals/steps-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { createInAppNotificationBulk } from "@/lib/notifications/in-app";
import { dispatchNotifications } from "@/lib/notifications/orchestrator";
import { z } from "zod";

const VoteSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().max(5000).optional(),
});

/** PATCH /api/v1/approvals/[id]/steps/[stepId] - Vote on a step */
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
      ipAddress: getClientIp(req),
      details: {
        request_id: id,
        step_complete: result.stepComplete,
        all_steps_complete: result.allStepsComplete,
        request_approved: result.requestApproved,
      },
    });

    // Notify when a step is decided (approved or rejected)
    if (result.stepComplete) {
      after(async () => {
        const notifyAdmin = createAdminClient();
        const [{ data: stepData }, { data: reqData }] = await Promise.all([
          notifyAdmin.from("approval_steps").select("name, step_order").eq("id", stepId).single(),
          notifyAdmin.from("approval_requests").select("title, priority, assigned_approvers, connection_id").eq("id", id).single(),
        ]);
        const stepName = stepData?.name ?? `Step ${stepData?.step_order ?? "?"}`;
        const reqTitle = reqData?.title ?? "Untitled request";
        const decision = result.stepApproved ? "approved" : "rejected";

        // Dispatch to channels (Slack, email, etc.)
        const eventType = result.stepApproved ? "approval.approved" : "approval.rejected";
        await dispatchNotifications({
          type: eventType,
          orgId: membership.org_id,
          requestId: id,
          requestTitle: `[${stepName}] ${reqTitle}`,
          requestPriority: reqData?.priority ?? "medium",
          connectionId: reqData?.connection_id ?? undefined,
          decidedBy: profile.id,
        });

        // In-app notification for relevant users
        const approvers: string[] = reqData?.assigned_approvers ?? [];
        const recipients = approvers.filter((uid) => uid !== profile.id);
        if (recipients.length > 0) {
          await createInAppNotificationBulk(recipients, {
            orgId: membership.org_id,
            category: "flow_step_decided",
            title: `${stepName} ${decision}`,
            body: `${stepName} was ${decision} for "${reqTitle}"${result.nextStep ? ". The next step is now active." : result.requestApproved ? ". All steps complete, request approved." : ". The request was rejected."}`,
            resourceType: "approval_request",
            resourceId: id,
            actorId: profile.id,
            actorName: profile.full_name ?? profile.email,
          });
        }
      });
    }

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to record vote";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
