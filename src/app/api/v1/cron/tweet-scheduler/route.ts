// ---------------------------------------------------------------------------
// OKrunit -- Cron: Tweet Scheduler
// ---------------------------------------------------------------------------
// Runs every 5 minutes. Generates upcoming drafts ahead of their slot times,
// notifies the founder via configured messaging connections, and posts any
// drafts that have been approved and reached their scheduled time.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/api/cron-auth";
import { runScheduler } from "@/lib/tweets/scheduler";
import { captureError } from "@/lib/monitoring/capture";

export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runScheduler();
    return NextResponse.json(result);
  } catch (error) {
    captureError({ error, service: "TweetScheduler" }).catch(() => {});
    return NextResponse.json({ error: "Scheduler failed" }, { status: 500 });
  }
}
