// ---------------------------------------------------------------------------
// OKrunit -- OAuth Grants API: List active OAuth connections
// GET /api/v1/oauth/grants
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { getActiveOAuthGrants } from "@/lib/api/oauth-grants";
// ---- GET /api/v1/oauth/grants -----------------------------------------------

export async function GET(request: Request) {
  try {
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(403, "Only dashboard users can view connected apps");
    }

    if (auth.membership.role !== "owner" && auth.membership.role !== "admin") {
      throw new ApiError(403, "Insufficient permissions");
    }

    const grants = await getActiveOAuthGrants(auth.orgId);

    return NextResponse.json({ data: grants });
  } catch (err) {
    return errorResponse(err);
  }
}
