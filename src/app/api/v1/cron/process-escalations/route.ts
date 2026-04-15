// ---------------------------------------------------------------------------
// OKrunit -- Cron: Process Approval Escalations
// ---------------------------------------------------------------------------
// Runs every 5 minutes. Checks all orgs with escalation enabled for
// pending approval requests that are due for escalation.
//
// Auth: x-cron-secret header (same pattern as weekly-digest, purge-deleted)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processEscalationsForOrg } from "@/lib/api/escalation";
import { captureError } from "@/lib/monitoring/capture";
import { verifyCronAuth } from "@/lib/api/cron-auth";
import type { EscalationConfig } from "@/lib/types/database";

export async function GET(request: Request) {
  return handleEscalations(request);
}

async function handleEscalations(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date();

  // 2. Fetch all orgs with escalation config
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, escalation_config")
    .not("escalation_config", "is", null);

  if (!orgs || orgs.length === 0) {
    return NextResponse.json({ processed: 0, orgs: 0 });
  }

  // 3. Process each org with escalation enabled
  let totalProcessed = 0;
  let totalErrors = 0;
  let orgsProcessed = 0;

  await Promise.allSettled(
    orgs
      .filter((o) => (o.escalation_config as EscalationConfig)?.enabled)
      .map(async (org) => {
        try {
          const result = await processEscalationsForOrg(
            org.id,
            org.escalation_config as EscalationConfig,
            now,
          );
          totalProcessed += result.processed;
          totalErrors += result.errors;
          orgsProcessed++;
        } catch (err) {
          totalErrors++;
          captureError({
            error: err,
            service: "Escalation",
            tags: { org_id: org.id },
          }).catch(() => {});
        }
      }),
  );

  return NextResponse.json({
    processed: totalProcessed,
    errors: totalErrors,
    orgs: orgsProcessed,
  });
}
