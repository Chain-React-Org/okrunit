// ---------------------------------------------------------------------------
// OKrunit -- Approval Rules API: List + Create
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createRuleSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

// ---- GET /api/v1/rules ----------------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may manage rules.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage rules");
    }

    const admin = createAdminClient();

    const { data: rules, error } = await admin
      .from("approval_rules")
      .select("*")
      .eq("org_id", auth.orgId)
      .order("priority_order", { ascending: true });

    if (error) {
      console.error("[Rules] Failed to list rules:", error);
      throw new ApiError(500, "Failed to list rules");
    }

    return NextResponse.json({ data: rules });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- POST /api/v1/rules ---------------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may create rules.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage rules");
    }

    // Must be owner or admin.
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    // Validate request body.
    let body: z.infer<typeof createRuleSchema>;
    try {
      body = createRuleSchema.parse(await request.json());
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

    // If no priority_order is provided, place the rule at the end.
    let priorityOrder = body.priority_order;
    if (priorityOrder == null) {
      const { data: lastRule } = await admin
        .from("approval_rules")
        .select("priority_order")
        .eq("org_id", auth.orgId)
        .order("priority_order", { ascending: false })
        .limit(1)
        .single();

      priorityOrder = lastRule ? lastRule.priority_order + 1 : 0;
    }

    const { data: rule, error } = await admin
      .from("approval_rules")
      .insert({
        org_id: auth.orgId,
        name: body.name,
        description: body.description ?? null,
        is_active: body.is_active ?? true,
        priority_order: priorityOrder,
        conditions: body.conditions,
        action: body.action,
        action_config: body.action_config ?? {},
        connection_id: body.connection_id ?? null,
        created_by: auth.user.id,
      })
      .select("*")
      .single();

    if (error || !rule) {
      console.error("[Rules] Failed to create rule:", error);
      throw new ApiError(500, "Failed to create rule");
    }

    // Audit the creation.
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "rule.created",
      resourceType: "approval_rule",
      resourceId: rule.id,
      details: { name: body.name, action: body.action },
      ipAddress,
    });

    revalidateTags(CacheTags.rules(auth.orgId));

    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
