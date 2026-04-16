// ---------------------------------------------------------------------------
// OKrunit -- Cron: Error Rate Spike Detection
// ---------------------------------------------------------------------------
// Runs every 5 minutes. Compares recent error rate to baseline and alerts
// via Discord if a spike is detected.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/api/cron-auth";
import { checkErrorRateSpike } from "@/lib/monitoring/spike-detection";
import { captureError } from "@/lib/monitoring/capture";

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await checkErrorRateSpike();
    return NextResponse.json(result);
  } catch (error) {
    captureError({ error, service: "ErrorRateCheck" }).catch(() => {});
    return NextResponse.json({ error: "Spike check failed" }, { status: 500 });
  }
}
