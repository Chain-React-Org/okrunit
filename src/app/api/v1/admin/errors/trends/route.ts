// ---------------------------------------------------------------------------
// OKrunit -- Admin Error Trends API: GET (hourly/daily error counts)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { getAppAdminContext } from "@/lib/app-admin";
import { createAdminClient } from "@/lib/supabase/admin";
export async function GET(request: Request) {
  try {
    const profile = await getAppAdminContext();
    if (!profile) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const days = Math.min(Number(searchParams.get("days") ?? 7), 90);

    const admin = createAdminClient();
    const since = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Fetch events with just created_at and severity for bucketing
    const { data: events } = await admin
      .from("error_events")
      .select("created_at, severity")
      .gte("created_at", since)
      .order("created_at", { ascending: true });

    // Bucket by day
    const buckets: Record<string, { total: number; fatal: number; error: number; warning: number; info: number }> = {};

    for (const event of events ?? []) {
      const day = event.created_at.slice(0, 10); // YYYY-MM-DD
      if (!buckets[day]) {
        buckets[day] = { total: 0, fatal: 0, error: 0, warning: 0, info: 0 };
      }
      buckets[day].total++;
      const sev = event.severity as keyof typeof buckets[string];
      if (sev in buckets[day]) {
        buckets[day][sev]++;
      }
    }

    // Convert to sorted array
    const trends = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({ date, ...counts }));

    return NextResponse.json({ trends });
  } catch (error) {
    console.error("[AdminErrors] Trends error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
