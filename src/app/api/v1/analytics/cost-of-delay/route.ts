// ---------------------------------------------------------------------------
// OKrunit -- Analytics: Cost of Delay API
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { getCostOfDelay } from "@/lib/api/analytics";
// ---- GET /api/v1/analytics/cost-of-delay ---------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate -- session only (dashboard users)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can access analytics",
        "SESSION_REQUIRED",
      );
    }

    const orgId = auth.orgId;

    // 2. Fetch pending approvals with age and estimated impact
    const items = await getCostOfDelay(orgId);

    // 3. Compute summary statistics
    const totalPending = items.length;
    const avgAgeMinutes =
      totalPending > 0
        ? Math.round(
            (items.reduce((sum, item) => sum + item.age_minutes, 0) /
              totalPending) *
              100,
          ) / 100
        : 0;

    const criticalCount = items.filter(
      (item) => item.priority === "critical",
    ).length;
    const highCount = items.filter(
      (item) => item.priority === "high",
    ).length;

    const oldestItem = items.length > 0 ? items[0] : null;

    return NextResponse.json({
      summary: {
        total_pending: totalPending,
        avg_age_minutes: avgAgeMinutes,
        critical_pending: criticalCount,
        high_pending: highCount,
        oldest_age_minutes: oldestItem?.age_minutes ?? 0,
      },
      items,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
