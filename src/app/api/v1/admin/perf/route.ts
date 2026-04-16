// ---------------------------------------------------------------------------
// OKrunit -- Web Vitals Capture API
// ---------------------------------------------------------------------------
// POST: receives web vitals from client, stores in database
// GET: returns aggregated vitals for admin dashboard
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkIpRateLimit, getClientIp, rateLimitResponse } from "@/lib/api/ip-rate-limiter";

const VITALS_RATE_LIMIT = { limit: 30, windowSeconds: 60 };

const vitalSchema = z.object({
  metric: z.enum(["LCP", "FID", "CLS", "INP", "TTFB", "FCP"]),
  value: z.number(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  pathname: z.string().max(500).optional(),
  userAgent: z.string().max(500).optional(),
  connectionType: z.string().max(50).optional(),
});

// ---- POST /api/v1/admin/perf -----------------------------------------------

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`vitals:${ip}`, VITALS_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const body = vitalSchema.parse(await request.json());
    const admin = createAdminClient();

    await admin.from("web_vitals").insert({
      metric: body.metric,
      value: body.value,
      rating: body.rating,
      pathname: body.pathname ?? null,
      user_agent: body.userAgent ?? null,
      connection_type: body.connectionType ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid vital data" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to store vital" }, { status: 500 });
  }
}

// ---- GET /api/v1/admin/perf ------------------------------------------------

export async function GET(request: Request) {
  try {
    // Simple auth check: require app admin via session
    const { authenticateRequest } = await import("@/lib/api/auth");
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const url = new URL(request.url);
    const days = Math.min(parseInt(url.searchParams.get("days") ?? "7"), 30);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Fetch recent vitals grouped by metric
    const { data: vitals } = await admin
      .from("web_vitals")
      .select("metric, value, rating, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (!vitals || vitals.length === 0) {
      return NextResponse.json({ metrics: {}, totalSamples: 0 });
    }

    // Aggregate by metric
    const metrics: Record<string, {
      p50: number;
      p75: number;
      p95: number;
      good: number;
      needsImprovement: number;
      poor: number;
      count: number;
    }> = {};

    const grouped: Record<string, number[]> = {};
    const ratings: Record<string, Record<string, number>> = {};

    for (const v of vitals) {
      if (!grouped[v.metric]) {
        grouped[v.metric] = [];
        ratings[v.metric] = { good: 0, "needs-improvement": 0, poor: 0 };
      }
      grouped[v.metric].push(v.value);
      ratings[v.metric][v.rating]++;
    }

    for (const [metric, values] of Object.entries(grouped)) {
      values.sort((a, b) => a - b);
      const r = ratings[metric];
      metrics[metric] = {
        p50: percentile(values, 50),
        p75: percentile(values, 75),
        p95: percentile(values, 95),
        good: r.good,
        needsImprovement: r["needs-improvement"],
        poor: r.poor,
        count: values.length,
      };
    }

    return NextResponse.json({ metrics, totalSamples: vitals.length });
  } catch {
    return NextResponse.json({ error: "Failed to fetch vitals" }, { status: 500 });
  }
}

function percentile(sorted: number[], p: number): number {
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)];
}
