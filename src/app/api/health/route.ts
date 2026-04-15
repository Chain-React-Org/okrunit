// ---------------------------------------------------------------------------
// OKrunit -- Health Check Endpoint
// ---------------------------------------------------------------------------
// Returns 200 if the app is healthy and Supabase is reachable.
// Used by uptime monitors, status pages, and load balancers.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const start = Date.now();

  try {
    const admin = createAdminClient();

    // Simple query to verify database connectivity
    const { error } = await admin
      .from("organizations")
      .select("id")
      .limit(1);

    const duration = Date.now() - start;

    if (error) {
      console.error("[Health] Database check failed:", error.message);
      return NextResponse.json(
        {
          status: "unhealthy",
          database: "unreachable",
          duration_ms: duration,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      duration_ms: duration,
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "error",
        duration_ms: Date.now() - start,
      },
      { status: 503 },
    );
  }
}
