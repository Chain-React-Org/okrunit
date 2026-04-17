// ---------------------------------------------------------------------------
// OKrunit -- OAuth Client Management: Get, Update, Delete
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateScopes } from "@/lib/api/oauth";
import { OAUTH_SCOPES } from "@/lib/constants";
import { logger } from "@/lib/monitoring/logger";

const CLIENT_COLUMNS =
  "id, org_id, name, logo_url, client_id, client_secret_prefix, redirect_uris, scopes, is_active, created_by, created_at, updated_at" as const;

const updateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  logo_url: z.string().url().nullable().optional(),
  redirect_uris: z.array(z.string().url()).min(1).max(10).optional(),
  scopes: z.array(z.string()).min(1).optional(),
  is_active: z.boolean().optional(),
});

// ---- GET /api/v1/oauth/clients/[id] ----------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage OAuth clients");
    }

    const admin = createAdminClient();

    const { data: client, error } = await admin
      .from("oauth_clients")
      .select(CLIENT_COLUMNS)
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (error || !client) {
      throw new ApiError(404, "OAuth client not found");
    }

    return NextResponse.json({ data: client });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- PATCH /api/v1/oauth/clients/[id] --------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage OAuth clients");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    let body: z.infer<typeof updateClientSchema>;
    try {
      body = updateClientSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    if (body.scopes && !validateScopes(body.scopes)) {
      throw new ApiError(
        400,
        `Invalid scopes. Valid scopes are: ${OAUTH_SCOPES.join(", ")}`,
        "INVALID_SCOPES",
      );
    }

    const admin = createAdminClient();

    // Verify the client belongs to this org.
    const { data: existing } = await admin
      .from("oauth_clients")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!existing) {
      throw new ApiError(404, "OAuth client not found");
    }

    const { data: client, error } = await admin
      .from("oauth_clients")
      .update({
        ...(body.name !== undefined && { name: body.name }),
        ...(body.logo_url !== undefined && { logo_url: body.logo_url }),
        ...(body.redirect_uris !== undefined && {
          redirect_uris: body.redirect_uris,
        }),
        ...(body.scopes !== undefined && { scopes: body.scopes }),
        ...(body.is_active !== undefined && { is_active: body.is_active }),
      })
      .eq("id", id)
      .select(CLIENT_COLUMNS)
      .single();

    if (error || !client) {
      logger.error("[OAuth Clients] Failed to update client:", error);
      throw new ApiError(500, "Failed to update OAuth client");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "oauth.client_updated",
      resourceType: "oauth_client",
      resourceId: id,
      details: body,
      ipAddress,
    });

    return NextResponse.json({ data: client });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/oauth/clients/[id] -------------------------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage OAuth clients");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const admin = createAdminClient();

    // Verify the client belongs to this org.
    const { data: existing } = await admin
      .from("oauth_clients")
      .select("id, name, client_id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!existing) {
      throw new ApiError(404, "OAuth client not found");
    }

    // Delete cascades to auth codes, access tokens, and refresh tokens.
    const { error } = await admin
      .from("oauth_clients")
      .delete()
      .eq("id", id);

    if (error) {
      logger.error("[OAuth Clients] Failed to delete client:", error);
      throw new ApiError(500, "Failed to delete OAuth client");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "oauth.client_deleted",
      resourceType: "oauth_client",
      resourceId: id,
      details: { name: existing.name, client_id: existing.client_id },
      ipAddress,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}
