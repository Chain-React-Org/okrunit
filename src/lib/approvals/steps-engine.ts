/**
 * Multi-step approval execution engine.
 * Manages step progression, vote counting, and step activation.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ApprovalStep } from "@/lib/types/database";

/** Activate the first step of a multi-step approval */
export async function activateFirstStep(requestId: string) {
  const admin = createAdminClient();

  const { data: firstStep } = await admin
    .from("approval_steps")
    .select("*")
    .eq("request_id", requestId)
    .eq("step_order", 1)
    .single();

  if (!firstStep) return;

  await admin
    .from("approval_steps")
    .update({
      status: "active",
      activated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", firstStep.id);

  await admin
    .from("approval_requests")
    .update({ current_step: 1 })
    .eq("id", requestId);
}

/** Record a vote on a step and check if the step is complete */
export async function recordStepVote(
  stepId: string,
  requestId: string,
  userId: string,
  vote: "approve" | "reject",
  comment?: string,
  source = "dashboard",
): Promise<{
  stepComplete: boolean;
  stepApproved: boolean;
  allStepsComplete: boolean;
  requestApproved: boolean;
  nextStep: ApprovalStep | null;
}> {
  const admin = createAdminClient();

  // Get the step
  const { data: step } = await admin
    .from("approval_steps")
    .select("*")
    .eq("id", stepId)
    .single();

  if (!step || step.status !== "active") {
    throw new Error("Step is not active");
  }

  // Check if user is authorized to vote on this step
  const authorized = await isAuthorizedForStep(step as ApprovalStep, userId);
  if (!authorized) {
    throw new Error("You are not authorized to vote on this step");
  }

  // Record the vote
  await admin.from("step_votes").insert({
    step_id: stepId,
    request_id: requestId,
    user_id: userId,
    vote,
    comment: comment ?? null,
    source,
  });

  // If rejection, immediately reject the step and the entire request
  if (vote === "reject") {
    await admin
      .from("approval_steps")
      .update({
        status: "rejected",
        completed_at: new Date().toISOString(),
        decided_by: userId,
        decision_comment: comment ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stepId);

    // Reject the entire request
    await admin
      .from("approval_requests")
      .update({
        status: "rejected",
        decided_by: userId,
        decided_at: new Date().toISOString(),
        decision_comment: comment ?? `Rejected at step: ${step.name}`,
        decision_source: source,
        updated_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    return {
      stepComplete: true,
      stepApproved: false,
      allStepsComplete: true,
      requestApproved: false,
      nextStep: null,
    };
  }

  // Approval vote — increment counter
  const newCount = (step.current_approvals ?? 0) + 1;
  const stepApproved = newCount >= step.required_approvals;

  if (stepApproved) {
    // Mark step as approved
    await admin
      .from("approval_steps")
      .update({
        status: "approved",
        current_approvals: newCount,
        completed_at: new Date().toISOString(),
        decided_by: userId,
        decision_comment: comment ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stepId);

    // Check if there's a next step
    const { data: nextStep } = await admin
      .from("approval_steps")
      .select("*")
      .eq("request_id", requestId)
      .eq("step_order", step.step_order + 1)
      .single();

    if (nextStep) {
      // Activate next step
      await admin
        .from("approval_steps")
        .update({
          status: "active",
          activated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", nextStep.id);

      await admin
        .from("approval_requests")
        .update({
          current_step: step.step_order + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return {
        stepComplete: true,
        stepApproved: true,
        allStepsComplete: false,
        requestApproved: false,
        nextStep: nextStep as ApprovalStep,
      };
    } else {
      // All steps complete — approve the request
      await admin
        .from("approval_requests")
        .update({
          status: "approved",
          decided_by: userId,
          decided_at: new Date().toISOString(),
          decision_comment: "All approval steps completed",
          decision_source: source,
          updated_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return {
        stepComplete: true,
        stepApproved: true,
        allStepsComplete: true,
        requestApproved: true,
        nextStep: null,
      };
    }
  } else {
    // Step not yet complete — just update counter
    await admin
      .from("approval_steps")
      .update({
        current_approvals: newCount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", stepId);

    return {
      stepComplete: false,
      stepApproved: false,
      allStepsComplete: false,
      requestApproved: false,
      nextStep: null,
    };
  }
}

/** Check if a user is authorized to vote on a step */
async function isAuthorizedForStep(step: ApprovalStep, userId: string): Promise<boolean> {
  const admin = createAdminClient();

  // Check specific user assignment
  if (step.assigned_user_ids && step.assigned_user_ids.length > 0) {
    return step.assigned_user_ids.includes(userId);
  }

  // Check team assignment
  if (step.assigned_team_id) {
    const { count } = await admin
      .from("team_memberships")
      .select("*", { count: "exact", head: true })
      .eq("team_id", step.assigned_team_id)
      .eq("user_id", userId);
    return (count ?? 0) > 0;
  }

  // Check role assignment
  if (step.assigned_role) {
    // Get the org_id from the request
    const { data: request } = await admin
      .from("approval_requests")
      .select("org_id")
      .eq("id", step.request_id)
      .single();

    if (!request) return false;

    const { data: membership } = await admin
      .from("org_memberships")
      .select("role")
      .eq("org_id", request.org_id)
      .eq("user_id", userId)
      .single();

    if (!membership) return false;

    const roleHierarchy = { member: 0, admin: 1, owner: 2 };
    const userLevel = roleHierarchy[membership.role as keyof typeof roleHierarchy] ?? 0;
    const requiredLevel = roleHierarchy[step.assigned_role as keyof typeof roleHierarchy] ?? 0;
    return userLevel >= requiredLevel;
  }

  // No assignment restrictions — any org member can vote
  return true;
}

/** Get all steps for a request with vote details */
export async function getRequestSteps(requestId: string) {
  const admin = createAdminClient();

  const { data: steps } = await admin
    .from("approval_steps")
    .select("*")
    .eq("request_id", requestId)
    .order("step_order");

  if (!steps || steps.length === 0) return [];

  const stepIds = steps.map((s) => s.id);
  const { data: votes } = await admin
    .from("step_votes")
    .select("*")
    .in("step_id", stepIds)
    .order("created_at");

  // Group votes by step
  const votesByStep = new Map<string, typeof votes>();
  for (const vote of votes ?? []) {
    const existing = votesByStep.get(vote.step_id) ?? [];
    existing.push(vote);
    votesByStep.set(vote.step_id, existing);
  }

  return steps.map((step) => ({
    ...step,
    votes: votesByStep.get(step.id) ?? [],
  }));
}
