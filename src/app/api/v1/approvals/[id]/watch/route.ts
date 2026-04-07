// ---------------------------------------------------------------------------
// OKrunit -- Watch / Unwatch an Approval Request
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest, type AuthResult } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";

function getUserId(auth: AuthResult): string | null {
  if (auth.type === "session") return auth.user.id;
  if (auth.type === "oauth") return auth.userId;
  return null;
}

// ---- GET /api/v1/approvals/[id]/watch - watcher list + status -------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateRequest(request);
    const { id } = await params;
    const admin = createAdminClient();

    // Verify the request belongs to this org
    const { data: approval } = await admin
      .from("approval_requests")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!approval) {
      throw new ApiError(404, "Approval not found");
    }

    const { data: watchers } = await admin
      .from("request_watchers")
      .select("user_id, created_at")
      .eq("request_id", id);

    const watcherList = watchers ?? [];
    const currentUserId = getUserId(auth);
    const isWatching = currentUserId ? watcherList.some((w) => w.user_id === currentUserId) : false;

    return NextResponse.json({
      watchers: watcherList,
      count: watcherList.length,
      isWatching,
    });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- POST /api/v1/approvals/[id]/watch - start watching ------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateRequest(request);
    const { id } = await params;
    const currentUserId = getUserId(auth);

    if (!currentUserId) {
      throw new ApiError(403, "Session or OAuth required to watch requests");
    }

    const admin = createAdminClient();

    // Verify the request belongs to this org
    const { data: approval } = await admin
      .from("approval_requests")
      .select("id")
      .eq("id", id)
      .eq("org_id", auth.orgId)
      .single();

    if (!approval) {
      throw new ApiError(404, "Approval not found");
    }

    await admin
      .from("request_watchers")
      .upsert(
        { request_id: id, user_id: currentUserId },
        { onConflict: "request_id,user_id" },
      );

    return NextResponse.json({ watching: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---- DELETE /api/v1/approvals/[id]/watch - stop watching ------------------

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await authenticateRequest(request);
    const { id } = await params;
    const currentUserId = getUserId(auth);

    if (!currentUserId) {
      throw new ApiError(403, "Session or OAuth required");
    }

    const admin = createAdminClient();

    await admin
      .from("request_watchers")
      .delete()
      .eq("request_id", id)
      .eq("user_id", currentUserId);

    return NextResponse.json({ watching: false });
  } catch (err) {
    return errorResponse(err);
  }
}
