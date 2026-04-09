// ---------------------------------------------------------------------------
// OKrunit -- Approval Audit Export API
//
// GET /api/v1/export?format=csv&start_date=2026-01-01&end_date=2026-03-22
//
// Exports approval history as CSV or JSON for compliance and auditing.
// Session authentication only (dashboard users).
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";

import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { exportQuerySchema } from "@/lib/api/validation";
import { logAuditEvent } from "@/lib/api/audit";

import { getClientIp } from "@/lib/api/ip-rate-limiter";
import {
  fetchExportData,
  generateCSV,
  generateJSON,
} from "@/lib/api/export";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// GET /api/v1/export
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    // 1. Authenticate -- session auth only (dashboard users)
    const auth = await authenticateRequest(request);

    if (auth.type !== "session") {
      throw new ApiError(
        403,
        "Session authentication required for exports. Use the dashboard.",
        "SESSION_REQUIRED",
      );
    }

    // 2. Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const queryInput = {
      format: searchParams.get("format") ?? undefined,
      start_date: searchParams.get("start_date") ?? undefined,
      end_date: searchParams.get("end_date") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      priority: searchParams.get("priority") ?? undefined,
    };

    const params = exportQuerySchema.parse(queryInput);

    // 3. Fetch export data
    const approvals = await fetchExportData(auth.orgId, {
      startDate: params.start_date,
      endDate: params.end_date,
      status: params.status,
      priority: params.priority,
    });

    // 4. Audit log the export
    logAuditEvent({
      orgId: auth.orgId,
      userId: auth.user.id,
      action: "export.created",
      resourceType: "approval_request",
      ipAddress: getClientIp(request),
      details: {
        format: params.format,
        filters: {
          start_date: params.start_date,
          end_date: params.end_date,
          status: params.status,
          priority: params.priority,
        },
        row_count: approvals.length,
      },
    });

    // 5. Generate and return the file
    const timestamp = new Date().toISOString().split("T")[0];

    if (params.format === "csv") {
      const csv = generateCSV(approvals);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="okrunit-approvals-${timestamp}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // JSON format
    const json = generateJSON(approvals);

    return new NextResponse(json, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="okrunit-approvals-${timestamp}.json"`,
        "Cache-Control": "no-store",
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
