// ---------------------------------------------------------------------------
// OKrunit -- Analytics API: GET (comprehensive approval metrics and trends)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { canUseFeature } from "@/lib/billing/enforce";
import { analyticsQuerySchema } from "@/lib/api/validation";
import {
  getApprovalSummary,
  getApprovalTrends,
  getApprovalsBySource,
  getApprovalsByPriority,
  getApprovalsByActionType,
  getTopRejectionReasons,
  getPerUserMetrics,
} from "@/lib/api/analytics";

// ---- Helpers --------------------------------------------------------------

/**
 * Resolve the start and end date from query parameters.
 * If explicit dates are provided, they take precedence.
 * Otherwise, the `period` param determines the range relative to now.
 * Defaults to "month" if nothing is specified.
 */
function resolveDateRange(params: {
  period?: string;
  start_date?: string;
  end_date?: string;
}): { startDate: string; endDate: string } {
  const now = new Date();
  const endDate = params.end_date ?? now.toISOString();

  if (params.start_date) {
    return { startDate: params.start_date, endDate };
  }

  const period = params.period ?? "month";
  const start = new Date(now);

  switch (period) {
    case "day":
      start.setUTCDate(start.getUTCDate() - 1);
      break;
    case "week":
      start.setUTCDate(start.getUTCDate() - 7);
      break;
    case "month":
    default:
      start.setUTCMonth(start.getUTCMonth() - 1);
      break;
  }

  return { startDate: start.toISOString(), endDate };
}

// ---- GET /api/v1/analytics ------------------------------------------------

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

    const featureCheck = await canUseFeature(orgId, "analytics");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "Upgrade required for analytics", "PLAN_LIMIT_EXCEEDED");
    }

    // 2. Parse and validate query params
    const { searchParams } = new URL(request.url);
    const queryInput = {
      period: searchParams.get("period") ?? undefined,
      start_date: searchParams.get("start_date") ?? undefined,
      end_date: searchParams.get("end_date") ?? undefined,
    };

    const params = analyticsQuerySchema.parse(queryInput);
    const { startDate, endDate } = resolveDateRange(params);

    // 3. Execute all analytics queries in parallel
    const [
      summary,
      trends,
      bySource,
      byPriority,
      byActionType,
      topRejectionReasons,
      perUser,
    ] = await Promise.all([
      getApprovalSummary(orgId, startDate, endDate),
      getApprovalTrends(orgId, startDate, endDate),
      getApprovalsBySource(orgId, startDate, endDate),
      getApprovalsByPriority(orgId, startDate, endDate),
      getApprovalsByActionType(orgId, startDate, endDate),
      getTopRejectionReasons(orgId, startDate, endDate, 10),
      getPerUserMetrics(orgId, startDate, endDate),
    ]);

    // 4. Return comprehensive analytics with cache headers
    return NextResponse.json({
      summary,
      trends: {
        daily: trends,
      },
      by_source: bySource,
      by_priority: byPriority,
      by_action_type: byActionType,
      top_rejection_reasons: topRejectionReasons,
      per_user: perUser,
      date_range: {
        start_date: startDate,
        end_date: endDate,
      },
    }, {
      headers: {
        "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
      },
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
