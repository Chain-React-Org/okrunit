// ---------------------------------------------------------------------------
// OKRunit -- SSO/SAML Configuration API
// ---------------------------------------------------------------------------

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest, type AuthResult } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { canUseFeature } from "@/lib/billing/enforce";
import type { SSOConfig } from "@/lib/types/database";

// ---- Validation -----------------------------------------------------------

const ssoConfigSchema = z.object({
  entity_id: z.string().min(1, "Entity ID is required").max(500),
  sso_url: z.string().url("SSO URL must be a valid URL").max(2000),
  certificate: z
    .string()
    .max(10000)
    .optional()
    .default(""),
  attribute_mapping: z
    .record(z.string(), z.string())
    .optional()
    .default({}),
  is_active: z.boolean().optional().default(false),
});

/** Validates that a certificate looks like PEM format */
function isValidCertificate(cert: string): boolean {
  return cert.includes("BEGIN CERTIFICATE") || cert.includes("MIIC") || cert.includes("MIID");
}

type SSOConfigInput = z.infer<typeof ssoConfigSchema>;

// ---- Helpers --------------------------------------------------------------

function requireSessionAdmin(auth: AuthResult): {
  userId: string;
  orgId: string;
} {
  if (auth.type !== "session") {
    throw new ApiError(403, "SSO configuration requires dashboard session authentication");
  }
  if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
    throw new ApiError(403, "Only organization owners and admins can manage SSO configuration");
  }
  return { userId: auth.user.id, orgId: auth.orgId };
}

// ---- GET: Retrieve current SSO config ------------------------------------

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    const { orgId } = requireSessionAdmin(auth);

    // Check feature access
    const featureCheck = await canUseFeature(orgId, "sso_saml");
    if (!featureCheck.allowed) {
      return NextResponse.json(
        {
          error: featureCheck.reason,
          upgrade_required: true,
          current_plan: featureCheck.plan,
        },
        { status: 403 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("sso_configs")
      .select("*")
      .eq("org_id", orgId)
      .single<SSOConfig>();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found (expected if not configured)
      throw new ApiError(500, "Failed to fetch SSO configuration");
    }

    return NextResponse.json({
      configured: !!data,
      config: data
        ? {
            id: data.id,
            provider: data.provider,
            entity_id: data.entity_id,
            sso_url: data.sso_url,
            // Do NOT return the full certificate for security; return a truncated preview
            certificate_preview: data.certificate.substring(0, 60) + "...",
            attribute_mapping: data.attribute_mapping,
            is_active: data.is_active,
            created_at: data.created_at,
            updated_at: data.updated_at,
          }
        : null,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- POST: Create or update SSO config -----------------------------------

export async function POST(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);
    const { userId, orgId } = requireSessionAdmin(auth);

    // Check feature access
    const featureCheck = await canUseFeature(orgId, "sso_saml");
    if (!featureCheck.allowed) {
      return NextResponse.json(
        {
          error: featureCheck.reason,
          upgrade_required: true,
          current_plan: featureCheck.plan,
        },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = ssoConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 },
      );
    }

    const input: SSOConfigInput = parsed.data;
    const admin = createAdminClient();

    // Check for existing config
    const { data: existing } = await admin
      .from("sso_configs")
      .select("id, certificate")
      .eq("org_id", orgId)
      .single();

    // Validate certificate: required for new config, optional for updates (keeps existing)
    const hasCert = input.certificate && input.certificate.trim().length > 0;
    if (!existing && !hasCert) {
      return NextResponse.json(
        { error: "Validation failed", details: { certificate: ["Certificate is required"] } },
        { status: 400 },
      );
    }
    if (hasCert && !isValidCertificate(input.certificate)) {
      return NextResponse.json(
        { error: "Validation failed", details: { certificate: ["Certificate must be in PEM format"] } },
        { status: 400 },
      );
    }

    const certificateValue = hasCert ? input.certificate : existing?.certificate;

    let result;
    if (existing) {
      // Update existing config
      const { data, error } = await admin
        .from("sso_configs")
        .update({
          entity_id: input.entity_id,
          sso_url: input.sso_url,
          certificate: certificateValue,
          attribute_mapping: input.attribute_mapping,
          is_active: input.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select("*")
        .single<SSOConfig>();

      if (error) {
        throw new ApiError(500, "Failed to update SSO configuration");
      }
      result = data;
    } else {
      // Create new config
      const { data, error } = await admin
        .from("sso_configs")
        .insert({
          org_id: orgId,
          provider: "saml",
          entity_id: input.entity_id,
          sso_url: input.sso_url,
          certificate: certificateValue!,
          attribute_mapping: input.attribute_mapping,
          is_active: input.is_active,
        })
        .select("*")
        .single<SSOConfig>();

      if (error) {
        throw new ApiError(500, "Failed to create SSO configuration");
      }
      result = data;
    }

    // Audit log
    await logAuditEvent({
      orgId,
      userId,
      action: existing ? "sso_config.updated" : "sso_config.created",
      resourceType: "sso_config",
      resourceId: result.id,
      details: {
        entity_id: input.entity_id,
        sso_url: input.sso_url,
        is_active: input.is_active,
      },
    });

    return NextResponse.json(
      {
        message: existing
          ? "SSO configuration updated successfully"
          : "SSO configuration created successfully",
        config: {
          id: result.id,
          provider: result.provider,
          entity_id: result.entity_id,
          sso_url: result.sso_url,
          certificate_preview: result.certificate.substring(0, 60) + "...",
          attribute_mapping: result.attribute_mapping,
          is_active: result.is_active,
          created_at: result.created_at,
          updated_at: result.updated_at,
        },
      },
      { status: existing ? 200 : 201 },
    );
  } catch (err) {
    return errorResponse(err);
  }
}
