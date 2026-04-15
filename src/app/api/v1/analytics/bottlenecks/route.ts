// ---------------------------------------------------------------------------
// OKrunit -- Bottleneck Detection API: GET
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { canUseFeature } from "@/lib/billing/enforce";
import {
  detectBottlenecks,
  getApprovalLoadDistribution,
  suggestRedistribution,
} from "@/lib/api/bottleneck";
// ---- GET /api/v1/analytics/bottlenecks -----------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate -- session only (dashboard users)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Only dashboard users can access bottleneck analytics",
        "SESSION_REQUIRED",
      );
    }

    const orgId = auth.orgId;

    const featureCheck = await canUseFeature(orgId, "analytics");
    if (!featureCheck.allowed) {
      throw new ApiError(403, featureCheck.reason ?? "Upgrade required for analytics");
    }

    // 2. Run bottleneck detection, load distribution, and redistribution in parallel
    const [detection, loadDistribution, suggestions] = await Promise.all([
      detectBottlenecks(orgId),
      getApprovalLoadDistribution(orgId),
      suggestRedistribution(orgId),
    ]);

    return NextResponse.json({
      load_distribution: loadDistribution,
      overloaded_users: detection.alerts,
      redistribution_suggestions: suggestions,
      threshold: detection.threshold,
      alert_enabled: detection.alertEnabled,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
