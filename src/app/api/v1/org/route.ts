// ---------------------------------------------------------------------------
// OKrunit -- Organization API: Update Organization
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

// ---- Validation -----------------------------------------------------------

const rejectionReasonPolicyEnum = z.enum(["optional", "required", "required_high_critical"]);

const slaConfigSchema = z.object({
  low: z.number().int().min(1).nullable(),
  medium: z.number().int().min(1).nullable(),
  high: z.number().int().min(1).nullable(),
  critical: z.number().int().min(1).nullable(),
});

const priorityEnum = z.enum(["low", "medium", "high", "critical"]);

const geoRestrictionsSchema = z.object({
  enabled: z.boolean(),
  allowed_countries: z.array(z.string().length(2, "Country code must be 2 characters (ISO 3166-1 alpha-2)")),
});

const fourEyesConfigSchema = z.object({
  enabled: z.boolean(),
  action_types: z.array(z.string().max(100)),
  min_priority: priorityEnum.nullable(),
});

const escalationTargetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("same_approvers") }),
  z.object({ type: z.literal("org_admins") }),
  z.object({ type: z.literal("team"), team_id: z.string().uuid() }),
  z.object({ type: z.literal("users"), user_ids: z.array(z.string().uuid()).min(1).max(20) }),
]);

const escalationLevelSchema = z.object({
  level: z.number().int().min(1).max(10),
  delay_minutes: z.number().int().min(1).max(43200),
  target: escalationTargetSchema,
});

const escalationConfigSchema = z.object({
  enabled: z.boolean(),
  levels: z.array(escalationLevelSchema).max(10),
});

const updateOrgSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long").optional(),
  rejection_reason_policy: rejectionReasonPolicyEnum.optional(),
  skip_decision_comment: z.boolean().optional(),
  sla_config: slaConfigSchema.optional(),
  bottleneck_threshold: z.number().int().min(1).max(1000).optional(),
  bottleneck_alert_enabled: z.boolean().optional(),
  ip_allowlist: z.array(z.string().max(50)).max(200).optional(),
  geo_restrictions: geoRestrictionsSchema.optional(),
  require_reauth_for_critical: z.boolean().optional(),
  session_timeout_minutes: z.number().int().min(5).max(43200).optional(),
  four_eyes_config: fourEyesConfigSchema.optional(),
  escalation_config: escalationConfigSchema.optional(),
  rejection_presets: z.array(z.string().max(200)).max(20).optional(),
}).refine(
  (data) =>
    data.name !== undefined ||
    data.rejection_reason_policy !== undefined ||
    data.skip_decision_comment !== undefined ||
    data.sla_config !== undefined ||
    data.bottleneck_threshold !== undefined ||
    data.bottleneck_alert_enabled !== undefined ||
    data.ip_allowlist !== undefined ||
    data.geo_restrictions !== undefined ||
    data.require_reauth_for_critical !== undefined ||
    data.session_timeout_minutes !== undefined ||
    data.four_eyes_config !== undefined ||
    data.escalation_config !== undefined ||
    data.rejection_presets !== undefined,
  { message: "At least one field must be provided" },
);

// ---- PATCH /api/v1/org ----------------------------------------------------

export async function PATCH(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can update organizations");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    let body: z.infer<typeof updateOrgSchema>;
    try {
      body = updateOrgSchema.parse(await request.json());
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

    const updatePayload: Record<string, unknown> = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.rejection_reason_policy !== undefined) updatePayload.rejection_reason_policy = body.rejection_reason_policy;
    if (body.skip_decision_comment !== undefined) updatePayload.skip_decision_comment = body.skip_decision_comment;
    if (body.sla_config !== undefined) updatePayload.sla_config = body.sla_config;
    if (body.bottleneck_threshold !== undefined) updatePayload.bottleneck_threshold = body.bottleneck_threshold;
    if (body.bottleneck_alert_enabled !== undefined) updatePayload.bottleneck_alert_enabled = body.bottleneck_alert_enabled;
    if (body.ip_allowlist !== undefined) updatePayload.ip_allowlist = body.ip_allowlist;
    if (body.geo_restrictions !== undefined) updatePayload.geo_restrictions = body.geo_restrictions;
    if (body.require_reauth_for_critical !== undefined) updatePayload.require_reauth_for_critical = body.require_reauth_for_critical;
    if (body.session_timeout_minutes !== undefined) updatePayload.session_timeout_minutes = body.session_timeout_minutes;
    if (body.four_eyes_config !== undefined) updatePayload.four_eyes_config = body.four_eyes_config;
    if (body.escalation_config !== undefined) updatePayload.escalation_config = body.escalation_config;
    if (body.rejection_presets !== undefined) updatePayload.rejection_presets = body.rejection_presets;

    const { data: org, error } = await admin
      .from("organizations")
      .update(updatePayload)
      .eq("id", auth.orgId)
      .select("*")
      .single();

    if (error || !org) {
      console.error("[Org] Failed to update organization:", error);
      throw new ApiError(500, "Failed to update organization");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "organization.updated",
      resourceType: "organization",
      resourceId: auth.orgId,
      details: updatePayload as Record<string, unknown>,
      ipAddress,
    });

    revalidateTags(CacheTags.settings(auth.orgId), CacheTags.orgContext(auth.user.id));

    return NextResponse.json({ data: org });
  } catch (err) {
    return errorResponse(err);
  }
}
