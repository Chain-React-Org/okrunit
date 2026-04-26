// Audit 13: Time-based behaviors that the other scripts can't cover.
// Verifies that the SLA-warning cron and the escalation cron actually fire
// against a real pending request whose deadlines have just elapsed.
//
// Approach: shrink the org's critical SLA to 1 minute and add a single
// escalation level at 2 minutes, create a critical-priority request, then
// wait through each window and manually invoke the cron endpoints with the
// shared CRON_SECRET. Restores the original org config in a finally block.
//
// Total runtime: about 2 minutes 15 seconds.
//
// Prereqs:
//   - /tmp/claude-audit/.cron-secret contains the CRON_SECRET value
//   - /tmp/claude-audit/org_id and /tmp/claude-audit/user_id exist (login.ts)
//   - The browser session in state/auth.json belongs to an owner/admin

import { openBrowser, log, BASE } from "./harness";
import * as fs from "fs";
import { execSync } from "child_process";

const ORG_ID = fs.readFileSync("/tmp/claude-audit/org_id", "utf8").trim();
const USER_ID = fs.readFileSync("/tmp/claude-audit/user_id", "utf8").trim();
const CRON_SECRET_PATH = "/tmp/claude-audit/cron-secret";

function readCronSecret(): string {
  const raw = fs.readFileSync(CRON_SECRET_PATH, "utf8").trim();
  if (!raw) {
    throw new Error(
      `${CRON_SECRET_PATH} is empty. Paste the CRON_SECRET value into it before running this audit.`,
    );
  }
  return raw;
}

function sqlQuery(sql: string): any {
  const tmp = "/tmp/claude-audit/.query.sql";
  fs.writeFileSync(tmp, sql);
  const out = execSync(
    `cd /Users/nathanielstoddard/okrunit && npx supabase db query --linked "$(cat ${tmp})"`,
    { encoding: "utf8", shell: "/bin/bash" },
  );
  const startIdx = out.indexOf("{");
  const jsonPart = out.slice(startIdx, out.lastIndexOf("}") + 1);
  return JSON.parse(jsonPart);
}

function getOrg() {
  return sqlQuery(`SELECT sla_config, escalation_config FROM organizations WHERE id = '${ORG_ID}';`).rows[0];
}

function getRequest(id: string) {
  return sqlQuery(
    `SELECT id, status, sla_deadline, sla_warning_sent, sla_breached, escalation_level, next_escalation_at, last_escalated_at FROM approval_requests WHERE id = '${id}';`,
  ).rows[0];
}

function sleepMs(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitUntil(target: Date, label: string) {
  const remaining = target.getTime() - Date.now();
  if (remaining > 0) {
    console.log(`  waiting ${Math.ceil(remaining / 1000)}s for ${label}...`);
    await sleepMs(remaining + 1000); // +1s buffer to be past the threshold
  }
}

async function main() {
  const phase = "Audit 13 (time-based)";
  const cronSecret = readCronSecret();
  const { browser, context, page } = await openBrowser();
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const originalOrg = getOrg();
  let requestId: string | null = null;
  let apiKeyConnectionId: string | null = null;

  try {
    // 1. Create a temporary API key (POST /api/v1/approvals refuses session auth)
    const keyResp = await page.request.post(`${BASE}/api/v1/connections`, {
      data: { name: `audit-13-${Date.now()}`, action_types: [], scoping_rules: {} },
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    });
    const keyBody = await keyResp.json().catch(() => ({}));
    const apiKey: string = keyBody?.api_key ?? keyBody?.key ?? "";
    apiKeyConnectionId = keyBody?.data?.id ?? null;
    log({
      phase,
      step: "create temporary API key",
      status: keyResp.ok() && apiKey ? "pass" : "fail",
      detail: `http=${keyResp.status()} hasKey=${!!apiKey}`,
    });
    if (!apiKey) throw new Error("api key creation failed");

    // 2. Configure aggressive SLA + escalation
    const setupResp = await page.request.patch(`${BASE}/api/v1/org`, {
      data: {
        sla_config: { low: null, medium: null, high: 60, critical: 1 },
        escalation_config: {
          enabled: true,
          levels: [
            {
              level: 1,
              delay_minutes: 2,
              target: { type: "org_admins" },
            },
          ],
        },
      },
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    });
    log({
      phase,
      step: "configure 1-min SLA + 2-min escalation",
      status: setupResp.ok() ? "pass" : "fail",
      detail: `http=${setupResp.status()}`,
    });
    if (!setupResp.ok()) throw new Error("setup failed");

    // 3. Create a critical-priority request via the API key (session auth is refused)
    const createResp = await page.request.post(`${BASE}/api/v1/approvals`, {
      data: {
        title: `Audit 13 time-based ${new Date().toISOString()}`,
        description: "Created by audit script. Should auto-cleanup.",
        priority: "critical",
        assigned_approvers: [USER_ID],
      },
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    });
    const createJson = await createResp.json().catch(() => ({}));
    requestId = createJson?.id ?? createJson?.data?.id ?? null;
    const createdAt = new Date();
    const fresh = requestId ? getRequest(requestId) : null;
    const slaSet = !!fresh?.sla_deadline;
    const escSet = !!fresh?.next_escalation_at;
    log({
      phase,
      step: "create critical request",
      status: createResp.ok() && requestId && slaSet && escSet ? "pass" : "fail",
      detail: `http=${createResp.status()} id=${requestId} slaDeadline=${slaSet} nextEscalation=${escSet}`,
    });
    if (!requestId || !slaSet || !escSet) throw new Error("create failed");

    // 3. SLA warning path: wait until 75% of the 60s SLA, then trigger cron
    const slaDeadline = new Date(fresh!.sla_deadline);
    const slaTotal = slaDeadline.getTime() - createdAt.getTime();
    const warningTime = new Date(createdAt.getTime() + slaTotal * 0.75);
    await waitUntil(warningTime, "SLA 75% mark");

    const warnResp = await page.request.get(
      `${BASE}/api/v1/cron/sla-warnings`,
      { headers: { "x-cron-secret": cronSecret } },
    );
    const warnJson = await warnResp.json().catch(() => ({}));
    const afterWarn = getRequest(requestId);
    const warningFired = afterWarn?.sla_warning_sent === true;
    log({
      phase,
      step: "trigger sla-warnings cron",
      status: warnResp.ok() && warningFired ? "pass" : "fail",
      detail: `http=${warnResp.status()} cronWarned=${warnJson?.warned} dbFlagSet=${warningFired}`,
    });

    // 4. Escalation path: wait past the 2-minute escalation mark, then trigger cron
    const escalationTime = new Date(createdAt.getTime() + 2 * 60 * 1000);
    await waitUntil(escalationTime, "escalation mark (2 min)");

    const escResp = await page.request.get(
      `${BASE}/api/v1/cron/process-escalations`,
      { headers: { "x-cron-secret": cronSecret } },
    );
    const escJson = await escResp.json().catch(() => ({}));
    const afterEsc = getRequest(requestId);
    const escalated =
      afterEsc?.escalation_level === 1 && !!afterEsc?.last_escalated_at;
    log({
      phase,
      step: "trigger process-escalations cron",
      status: escResp.ok() && escalated ? "pass" : "fail",
      detail: `http=${escResp.status()} cronProcessed=${escJson?.processed} dbLevel=${afterEsc?.escalation_level} lastEscalatedAt=${afterEsc?.last_escalated_at}`,
    });

    // 5. Confirm an audit-log row was written for the escalation
    const auditRow = sqlQuery(
      `SELECT count(*) AS n FROM audit_log WHERE org_id = '${ORG_ID}' AND action = 'approval.escalated' AND resource_id = '${requestId}';`,
    ).rows[0];
    log({
      phase,
      step: "audit log row for escalation",
      status: Number(auditRow?.n) >= 1 ? "pass" : "warn",
      detail: `count=${auditRow?.n}`,
    });
  } finally {
    // Cleanup: cancel the test request, restore the original org config
    if (requestId) {
      const cancelResp = await page.request.delete(
        `${BASE}/api/v1/approvals/${requestId}`,
        { headers: { Cookie: cookieHeader } },
      );
      log({
        phase,
        step: "cancel test request",
        status: cancelResp.ok() ? "pass" : "warn",
        detail: `http=${cancelResp.status()}`,
      });
    }

    if (apiKeyConnectionId) {
      // PATCH is_active=false instead of DELETE: the connection has by now
      // created an approval, which sets audit_log.connection_id, and the
      // hard-delete would violate that FK constraint.
      const delResp = await page.request.patch(
        `${BASE}/api/v1/connections/${apiKeyConnectionId}`,
        {
          data: { is_active: false },
          headers: { "Content-Type": "application/json", Cookie: cookieHeader },
        },
      );
      log({
        phase,
        step: "deactivate temporary API key",
        status: delResp.ok() ? "pass" : "warn",
        detail: `http=${delResp.status()}`,
      });
    }

    const restoreResp = await page.request.patch(`${BASE}/api/v1/org`, {
      data: {
        sla_config: originalOrg.sla_config ?? {
          low: null,
          medium: null,
          high: 60,
          critical: 15,
        },
        escalation_config: originalOrg.escalation_config ?? {
          enabled: false,
          levels: [],
        },
      },
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    });
    log({
      phase,
      step: "restore original org config",
      status: restoreResp.ok() ? "pass" : "warn",
      detail: `http=${restoreResp.status()}`,
    });

    await browser.close();
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
