// ---------------------------------------------------------------------------
// OKrunit -- OAuth Client Management: List + Create
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { canUseFeature } from "@/lib/billing/enforce";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateClientCredentials, validateScopes } from "@/lib/api/oauth";
import { OAUTH_SCOPES } from "@/lib/constants";

// Column allowlist. Never return client_secret_hash.
const CLIENT_COLUMNS =
  "id, org_id, name, logo_url, client_id, client_secret_prefix, redirect_uris, scopes, is_active, created_by, created_at, updated_at" as const;

// ---- Schemas ---------------------------------------------------------------

const createClientSchema = z.object({
  name: z.string().min(1).max(200),
  logo_url: z.string().url().optional(),
  redirect_uris: z.array(z.string().url()).min(1).max(10),
  scopes: z
    .array(z.string())
    .min(1)
    .default([...OAUTH_SCOPES]),
});

// ---- GET /api/v1/oauth/clients ---------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage OAuth clients");
    }

    const admin = createAdminClient();

    const { data: clients, error } = await admin
      .from("oauth_clients")
      .select(CLIENT_COLUMNS)
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[OAuth Clients] Failed to list clients:", error);
      throw new ApiError(500, "Failed to list OAuth clients");
    }

    return NextResponse.json({ data: clients });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- POST /api/v1/oauth/clients --------------------------------------------

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can manage OAuth clients");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const featureCheck = await canUseFeature(auth.orgId, "api_access");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "OAuth clients require a Pro plan or higher", "PLAN_LIMIT_EXCEEDED");
    }

    let body: z.infer<typeof createClientSchema>;
    try {
      body = createClientSchema.parse(await request.json());
    } catch (err) {
      if (err instanceof z.ZodError) {
        return NextResponse.json(
          { error: "Validation failed", issues: err.issues },
          { status: 400 },
        );
      }
      throw err;
    }

    // Validate scopes.
    if (!validateScopes(body.scopes)) {
      throw new ApiError(
        400,
        `Invalid scopes. Valid scopes are: ${OAUTH_SCOPES.join(", ")}`,
        "INVALID_SCOPES",
      );
    }

    // Generate client credentials.
    const { clientId, clientSecret, clientSecretHash, clientSecretPrefix } =
      generateClientCredentials();

    const admin = createAdminClient();

    const { data: client, error } = await admin
      .from("oauth_clients")
      .insert({
        org_id: auth.orgId,
        name: body.name,
        logo_url: body.logo_url || null,
        client_id: clientId,
        client_secret_hash: clientSecretHash,
        client_secret_prefix: clientSecretPrefix,
        redirect_uris: body.redirect_uris,
        scopes: body.scopes,
        is_active: true,
        created_by: auth.user.id,
      })
      .select(CLIENT_COLUMNS)
      .single();

    if (error || !client) {
      console.error("[OAuth Clients] Failed to create client:", error);
      throw new ApiError(500, "Failed to create OAuth client");
    }

    const ipAddress =
      request.headers.get("x-forwarded-for") ??
      request.headers.get("x-real-ip") ??
      "unknown";

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "oauth.client_created",
      resourceType: "oauth_client",
      resourceId: client.id,
      details: { name: body.name, client_id: clientId },
      ipAddress,
    });

    return NextResponse.json(
      {
        data: client,
        client_secret: clientSecret,
        client_secret_warning:
          "Store this secret securely. It will not be shown again.",
      },
      { status: 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
