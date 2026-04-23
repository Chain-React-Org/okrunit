// ---------------------------------------------------------------------------
// OKrunit -- Messaging identity unlink
// ---------------------------------------------------------------------------
// DELETE /api/v1/messaging/identities/[id]
//
// Removes the caller's own messaging_user_identities row. Scoped so a user
// can only unlink their own identity — admins can use the Members page to
// do more invasive things.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const auth = await authenticateRequest(_request);
    if (auth.type !== "session") {
      throw new ApiError(403, "Session authentication required", "SESSION_REQUIRED");
    }

    const admin = createAdminClient();
    const { data: existing } = await admin
      .from("messaging_user_identities")
      .select("id, user_id, org_id")
      .eq("id", id)
      .maybeSingle();

    if (!existing) {
      throw new ApiError(404, "Identity not found", "NOT_FOUND");
    }
    if (existing.user_id !== auth.user.id || existing.org_id !== auth.orgId) {
      throw new ApiError(403, "You can only unlink your own identity", "FORBIDDEN");
    }

    const { error } = await admin
      .from("messaging_user_identities")
      .delete()
      .eq("id", id);
    if (error) {
      throw new ApiError(500, "Failed to unlink identity");
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
