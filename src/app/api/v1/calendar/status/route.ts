// ---------------------------------------------------------------------------
// OKrunit -- Calendar Connection Status API
// ---------------------------------------------------------------------------
// GET:    Return calendar connection status for the authenticated user
// PATCH:  Update the auto_delegate_to setting
// DELETE: Disconnect calendar integration
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { logAuditEvent } from "@/lib/api/audit";
import { createAdminClient } from "@/lib/supabase/admin";

// ---- Schemas --------------------------------------------------------------

const patchSchema = z.object({
  auto_delegate_to: z.string().uuid().nullable(),
});

// ---- GET ------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    const admin = createAdminClient();

    const { data: connections, error } = await admin
      .from("calendar_connections")
      .select("id, provider, calendar_email, is_active, auto_delegate_to, created_at, updated_at")
      .eq("user_id", auth.user.id)
      .eq("org_id", auth.orgId);

    if (error) {
      console.error("[Calendar] Failed to fetch connections:", error);
      throw new ApiError(500, "Failed to fetch calendar connections");
    }

    return NextResponse.json({
      connections: connections ?? [],
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- PATCH ----------------------------------------------------------------

export async function PATCH(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    const body = await request.json();
    const parsed = patchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // Verify the delegate is a member of the same org (if set)
    if (parsed.data.auto_delegate_to) {
      const { data: member } = await admin
        .from("org_memberships")
        .select("user_id")
        .eq("org_id", auth.orgId)
        .eq("user_id", parsed.data.auto_delegate_to)
        .single();

      if (!member) {
        throw new ApiError(400, "Delegate must be a member of the same organization");
      }
    }

    // Update all connections for this user in this org
    const { data: updated, error } = await admin
      .from("calendar_connections")
      .update({
        auto_delegate_to: parsed.data.auto_delegate_to,
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", auth.user.id)
      .eq("org_id", auth.orgId)
      .select("id, provider, calendar_email, is_active, auto_delegate_to, updated_at");

    if (error) {
      console.error("[Calendar] Failed to update auto_delegate_to:", error);
      throw new ApiError(500, "Failed to update delegation setting");
    }

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "calendar.delegation_updated",
      resourceType: "calendar_connection",
      details: { auto_delegate_to: parsed.data.auto_delegate_to },
    });

    return NextResponse.json({ connections: updated ?? [] });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE ---------------------------------------------------------------

export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(401, "Session authentication required");
    }

    const admin = createAdminClient();

    const { error } = await admin
      .from("calendar_connections")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("org_id", auth.orgId);

    if (error) {
      console.error("[Calendar] Failed to delete connections:", error);
      throw new ApiError(500, "Failed to disconnect calendar");
    }

    await logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "calendar.disconnected",
      resourceType: "calendar_connection",
    });

    return NextResponse.json({ disconnected: true });
  } catch (err) {
    return errorResponse(err);
  }
}
