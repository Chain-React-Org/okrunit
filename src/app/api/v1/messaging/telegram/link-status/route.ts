// ---------------------------------------------------------------------------
// OKrunit -- Telegram Deep-Link Status Polling
// ---------------------------------------------------------------------------
// GET /api/v1/messaging/telegram/link-status?nonce=<nonce>
//
// The frontend polls this endpoint to detect when the user has pressed
// Start in Telegram and the connection has been created.
// ---------------------------------------------------------------------------

import { NextResponse, type NextRequest } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { errorResponse, ApiError } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request);

    let orgId: string;
    if (auth.type === "session") {
      orgId = auth.orgId;
    } else {
      throw new ApiError(401, "Session authentication required");
    }

    const nonce = request.nextUrl.searchParams.get("nonce");
    if (!nonce) {
      return NextResponse.json(
        { error: "Missing nonce parameter" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("telegram_link_nonces")
      .select("claimed_at, chat_id, chat_title, connection_id, expires_at")
      .eq("nonce", nonce)
      .eq("org_id", orgId)
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: "Link not found" },
        { status: 404 },
      );
    }

    // Check expiry
    if (!data.claimed_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({
        status: "expired",
      });
    }

    if (data.claimed_at) {
      return NextResponse.json({
        status: "claimed",
        chat_id: data.chat_id,
        chat_title: data.chat_title,
        connection_id: data.connection_id,
      });
    }

    return NextResponse.json({
      status: "pending",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
