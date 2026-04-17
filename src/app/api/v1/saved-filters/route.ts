// ---------------------------------------------------------------------------
// OKrunit -- Saved Filters API: GET (list) + POST (create) + DELETE (remove)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp } from "@/lib/api/ip-rate-limiter";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";

// ---- Validation Schemas ---------------------------------------------------

const createSavedFilterSchema = z.object({
  name: z.string().min(1).max(100),
  filters: z.record(z.string(), z.unknown()),
  is_default: z.boolean().optional(),
});

const deleteSavedFilterSchema = z.object({
  id: z.uuid(),
});

// ---- GET /api/v1/saved-filters --------------------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate -- session auth only (saved filters are per-user)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Saved filters are only available to dashboard users",
        "SESSION_REQUIRED",
      );
    }

    const admin = createAdminClient();

    // 2. Fetch saved filters for the current user within their org
    const { data: filters, error: filtersError } = await admin
      .from("saved_filters")
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("org_id", auth.orgId)
      .order("created_at", { ascending: true });

    if (filtersError) {
      logger.error(
        "[SavedFilters] Failed to fetch saved filters:",
        filtersError,
      );
      throw new ApiError(500, "Failed to fetch saved filters");
    }

    return NextResponse.json({ data: filters });
  } catch (error) {
    return errorResponse(error);
  }
}

// ---- POST /api/v1/saved-filters -------------------------------------------

export async function POST(request: Request) {
  try {
    // 1. Authenticate -- session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Saved filters are only available to dashboard users",
        "SESSION_REQUIRED",
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const validated = createSavedFilterSchema.parse(body);

    const admin = createAdminClient();

    // 3. If this filter is being set as default, clear existing defaults
    if (validated.is_default) {
      await admin
        .from("saved_filters")
        .update({ is_default: false })
        .eq("user_id", auth.user.id)
        .eq("org_id", auth.orgId)
        .eq("is_default", true);
    }

    // 4. Insert the new saved filter
    const { data: filter, error: insertError } = await admin
      .from("saved_filters")
      .insert({
        user_id: auth.user.id,
        org_id: auth.orgId,
        name: validated.name,
        filters: validated.filters,
        is_default: validated.is_default ?? false,
      })
      .select("*")
      .single();

    if (insertError || !filter) {
      logger.error(
        "[SavedFilters] Failed to insert saved filter:",
        insertError,
      );
      throw new ApiError(500, "Failed to create saved filter");
    }

    // 5. Audit log
    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "saved_filter.created",
      resourceType: "saved_filter",
      resourceId: filter.id,
      ipAddress: getClientIp(request),
      details: {
        name: validated.name,
        is_default: validated.is_default ?? false,
      },
    });

    return NextResponse.json(filter, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    return errorResponse(error);
  }
}

// ---- DELETE /api/v1/saved-filters -----------------------------------------

export async function DELETE(request: Request) {
  try {
    // 1. Authenticate -- session auth only
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Saved filters are only available to dashboard users",
        "SESSION_REQUIRED",
      );
    }

    // 2. Validate request body
    const body = await request.json();
    const validated = deleteSavedFilterSchema.parse(body);

    const admin = createAdminClient();

    // 3. Verify ownership: only delete filters belonging to the current user
    const { data: existing, error: fetchError } = await admin
      .from("saved_filters")
      .select("id")
      .eq("id", validated.id)
      .eq("user_id", auth.user.id)
      .eq("org_id", auth.orgId)
      .single();

    if (fetchError || !existing) {
      throw new ApiError(404, "Saved filter not found", "NOT_FOUND");
    }

    // 4. Delete the filter
    const { error: deleteError } = await admin
      .from("saved_filters")
      .delete()
      .eq("id", validated.id)
      .eq("user_id", auth.user.id);

    if (deleteError) {
      logger.error(
        "[SavedFilters] Failed to delete saved filter:",
        deleteError,
      );
      throw new ApiError(500, "Failed to delete saved filter");
    }

    // 5. Audit log
    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "saved_filter.deleted",
      resourceType: "saved_filter",
      resourceId: validated.id,
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 },
      );
    }
    return errorResponse(error);
  }
}
