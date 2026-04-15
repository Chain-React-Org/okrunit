// ---------------------------------------------------------------------------
// OKrunit -- Approval Templates API: List + Create
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest, hashApiKey } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createTemplateSchema, paginationSchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";

// ---- GET /api/v1/templates ------------------------------------------------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Resolve the org_id via standard auth OR client credentials fallback.
    // Make.com RPCs don't pass OAuth access tokens in headers, so we also
    // accept client_id + client_secret as query params for dropdown RPCs.
    let orgId: string;

    const authHeader = request.headers.get("authorization") || "";
    const hasValidBearer = authHeader.startsWith("Bearer ") && authHeader.length > 7;
    const clientId = searchParams.get("client_id");
    const clientSecret = searchParams.get("client_secret");

    if (hasValidBearer) {
      // Standard auth (OAuth token, API key, or session)
      const auth = await authenticateRequest(request);
      orgId = auth.orgId;
    } else if (clientId && clientSecret) {
      // Client credentials fallback for integration RPCs
      const admin = createAdminClient();
      const secretHash = hashApiKey(clientSecret);
      const { data: client } = await admin
        .from("oauth_clients")
        .select("org_id, is_active, client_secret_hash")
        .eq("client_id", clientId)
        .single();

      if (!client || !client.is_active || client.client_secret_hash !== secretHash) {
        throw new ApiError(401, "Invalid client credentials");
      }
      orgId = client.org_id;
    } else {
      // Try standard auth as last resort (handles session cookies)
      const auth = await authenticateRequest(request);
      orgId = auth.orgId;
    }

    // Parse query params (reuse searchParams from above)
    const queryInput = {
      page: searchParams.get("page")
        ? Number(searchParams.get("page"))
        : undefined,
      page_size: searchParams.get("page_size") || searchParams.get("limit")
        ? Number(searchParams.get("page_size") || searchParams.get("limit"))
        : undefined,
    };

    const params = paginationSchema.parse(queryInput);
    const page = params.page ?? 1;
    const pageSize = params.page_size ?? 20;

    // Check for include_inactive flag (default: only active templates)
    const includeInactive = searchParams.get("include_inactive") === "true";

    // Optional target_app filter (used by integration dropdowns)
    const targetApp = searchParams.get("target_app");

    const admin = createAdminClient();

    // Build query filtered by org_id
    let query = admin
      .from("approval_templates")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false });

    if (!includeInactive) {
      query = query.eq("is_active", true);
    }

    // Filter by target app: return only templates that match the requested app
    if (targetApp && ["n8n", "zapier", "make"].includes(targetApp)) {
      query = query.eq("target_app", targetApp);
    }

    // Paginate
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data: templates, error: queryError } = await query;

    if (queryError) {
      console.error("[Templates] Query failed:", queryError);
      throw new ApiError(500, "Failed to fetch templates");
    }

    // Count query for total
    let countQuery = admin
      .from("approval_templates")
      .select("*", { count: "exact", head: true })
      .eq("org_id", orgId);

    if (!includeInactive) {
      countQuery = countQuery.eq("is_active", true);
    }

    if (targetApp && ["n8n", "zapier", "make"].includes(targetApp)) {
      countQuery = countQuery.eq("target_app", targetApp);
    }

    const { count } = await countQuery;

    return NextResponse.json({
      data: templates ?? [],
      total: count ?? 0,
      page,
      page_size: pageSize,
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: err.issues },
        { status: 400 },
      );
    }
    return errorResponse(err);
  }
}

// ---- POST /api/v1/templates -----------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    // Only dashboard (session) users may create templates.
    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage templates");
    }

    // Must be admin or owner
    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions. Only admins and owners can create templates.");
    }

    // Validate request body
    let body: z.infer<typeof createTemplateSchema>;
    try {
      body = createTemplateSchema.parse(await request.json());
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

    const { data: template, error } = await admin
      .from("approval_templates")
      .insert({
        org_id: auth.orgId,
        name: body.name,
        description: body.description ?? null,
        title_pattern: body.title_pattern ?? null,
        action_type: body.action_type ?? null,
        default_priority: body.default_priority ?? "medium",
        assigned_approvers: body.assigned_approvers ?? [],
        conditions: body.conditions ?? {},
        metadata_schema: body.metadata_schema ?? {},
        callback_url_pattern: body.callback_url_pattern ?? null,
        is_active: body.is_active ?? true,
        target_app: body.target_app ?? "any",
        created_by: auth.user.id,
      })
      .select("*")
      .single();

    if (error || !template) {
      console.error("[Templates] Failed to create template:", error);
      throw new ApiError(500, "Failed to create template");
    }

    // Audit the creation
    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "template.created",
      resourceType: "approval_template",
      resourceId: template.id,
      details: { name: body.name },
      ipAddress,
    });

    return NextResponse.json({ data: template }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
