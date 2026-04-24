// ---------------------------------------------------------------------------
// OKrunit -- SLA Analytics API: GET
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { canUseFeature } from "@/lib/billing/enforce";
import { getSlaMetrics } from "@/lib/api/sla";

// ---- Validation -----------------------------------------------------------

const slaQuerySchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

// ---- GET /api/v1/analytics/sla -------------------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate -- session only (dashboard users)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can access SLA analytics",
        "SESSION_REQUIRED",
      );
    }

    const orgId = auth.orgId;

    const featureCheck = await canUseFeature(orgId, "analytics");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "Upgrade required for analytics", "PLAN_LIMIT_EXCEEDED");
    }

    // 2. Parse date range from query params
    const { searchParams } = new URL(request.url);
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");

    // Default: last 30 days
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const from = fromParam ?? thirtyDaysAgo.toISOString();
    const to = toParam ?? now.toISOString();

    // Validate date params if provided
    if (fromParam || toParam) {
      slaQuerySchema.parse({ from, to });
    }

    // 3. Get SLA metrics
    const metrics = await getSlaMetrics(orgId, { from, to });

    return NextResponse.json({
      ...metrics,
      date_range: { from, to },
    });
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
