// ---------------------------------------------------------------------------
// OKrunit -- Admin Error Issues API: GET (list with filtering/pagination)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ErrorIssue } from "@/lib/monitoring/types";
export async function GET(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const severity = searchParams.get("severity");
    const service = searchParams.get("service");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") ?? "last_seen";
    const limit = Math.min(Number(searchParams.get("limit") ?? 50), 100);
    const offset = Number(searchParams.get("offset") ?? 0);

    const admin = createAdminClient();
    let query = admin
      .from("error_issues")
      .select("*", { count: "exact" });

    if (status) query = query.eq("status", status);
    if (severity) query = query.eq("severity", severity);
    if (service) query = query.eq("service", service);
    if (search) query = query.ilike("title", `%${search}%`);

    // Sort
    switch (sort) {
      case "event_count":
        query = query.order("event_count", { ascending: false });
        break;
      case "affected_users":
        query = query.order("affected_users", { ascending: false });
        break;
      case "first_seen":
        query = query.order("first_seen_at", { ascending: false });
        break;
      case "last_seen":
      default:
        query = query.order("last_seen_at", { ascending: false });
        break;
    }

    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query.returns<ErrorIssue[]>();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Also fetch summary stats
    const [
      { count: unresolvedCount },
      { count: todayCount },
      { count: regressedCount },
    ] = await Promise.all([
      admin
        .from("error_issues")
        .select("*", { count: "exact", head: true })
        .eq("status", "unresolved"),
      admin
        .from("error_events")
        .select("*", { count: "exact", head: true })
        .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      admin
        .from("error_issues")
        .select("*", { count: "exact", head: true })
        .eq("status", "regressed"),
    ]);

    return NextResponse.json({
      issues: data ?? [],
      total: count ?? 0,
      stats: {
        unresolved: unresolvedCount ?? 0,
        today: todayCount ?? 0,
        regressed: regressedCount ?? 0,
      },
    });
  } catch (error) {
    console.error("[AdminErrors] GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
