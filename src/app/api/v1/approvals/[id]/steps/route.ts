import { NextRequest, NextResponse } from "next/server";
import { getOrgContext } from "@/lib/org-context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRequestSteps, activateFirstStep } from "@/lib/approvals/steps-engine";
import { z } from "zod";

const StepSchema = z.object({
  name: z.string().min(1).max(200),
  assigned_team_id: z.string().uuid().optional(),
  assigned_user_ids: z.array(z.string().uuid()).max(10).optional(),
  assigned_role: z.enum(["owner", "admin", "member"]).optional(),
  required_approvals: z.number().int().min(1).max(10).default(1),
  timeout_minutes: z.number().int().min(1).optional(),
});

const CreateStepsSchema = z.object({
  steps: z.array(StepSchema).min(1).max(10),
});

/** GET /api/v1/approvals/[id]/steps — List steps for an approval */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const steps = await getRequestSteps(id);
  return NextResponse.json({ steps });
}

/** POST /api/v1/approvals/[id]/steps — Add steps to an approval (must be pending, no existing steps) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getOrgContext();
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") {
    return NextResponse.json({ error: "Only admins can configure approval steps" }, { status: 403 });
  }

  const admin = createAdminClient();

  // Verify the approval exists, is pending, and belongs to this org
  const { data: approval } = await admin
    .from("approval_requests")
    .select("id, status, org_id, has_steps")
    .eq("id", id)
    .eq("org_id", membership.org_id)
    .single();

  if (!approval) return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  if (approval.status !== "pending") return NextResponse.json({ error: "Can only add steps to pending approvals" }, { status: 400 });
  if (approval.has_steps) return NextResponse.json({ error: "Steps already configured" }, { status: 400 });

  const body = await req.json();
  const parsed = CreateStepsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid steps", details: parsed.error.issues }, { status: 400 });
  }

  // Insert steps
  const stepsToInsert = parsed.data.steps.map((step, i) => ({
    request_id: id,
    step_order: i + 1,
    name: step.name,
    status: i === 0 ? "active" : "waiting",
    assigned_team_id: step.assigned_team_id ?? null,
    assigned_user_ids: step.assigned_user_ids ?? null,
    assigned_role: step.assigned_role ?? null,
    required_approvals: step.required_approvals,
    timeout_minutes: step.timeout_minutes ?? null,
    activated_at: i === 0 ? new Date().toISOString() : null,
  }));

  const { data: insertedSteps, error } = await admin
    .from("approval_steps")
    .insert(stepsToInsert)
    .select();

  if (error) {
    return NextResponse.json({ error: "Failed to create steps" }, { status: 500 });
  }

  // Update the approval request
  await admin
    .from("approval_requests")
    .update({
      has_steps: true,
      current_step: 1,
      total_steps: parsed.data.steps.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  return NextResponse.json({ steps: insertedSteps }, { status: 201 });
}
