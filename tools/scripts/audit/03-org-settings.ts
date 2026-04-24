// Audit 3: Org settings PATCH round-trip for every field the route accepts.
// We already know the page renders (Audit 1) and allow_self_approval persists
// (Audit 2). This script covers the rest by using the PATCH API directly with
// the authenticated session, then reading the row back to confirm persistence.

import { openBrowser, log, BASE } from "./harness";
import * as fs from "fs";
import { execSync } from "child_process";

const ORG_ID = fs.readFileSync("/tmp/claude-audit/org_id", "utf8").trim();

function sqlGetOrg() {
  const tmp = "/tmp/claude-audit/.getorg.sql";
  fs.writeFileSync(tmp, `SELECT * FROM organizations WHERE id = '${ORG_ID}';`);
  const out = execSync(
    `cd /Users/nathanielstoddard/okrunit && npx supabase db query --linked "$(cat ${tmp})"`,
    { encoding: "utf8", shell: "/bin/bash" },
  );
  const startIdx = out.indexOf("{");
  const jsonPart = out.slice(startIdx, out.lastIndexOf("}") + 1);
  return JSON.parse(jsonPart).rows[0];
}

async function main() {
  const phase = "Audit 3 (org settings)";
  const { browser, context, page } = await openBrowser();
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");

  const payloads: Array<{ label: string; body: any; check: (org: any) => boolean }> = [
    { label: "name", body: { name: "Claude Audit Renamed" }, check: (o) => o.name === "Claude Audit Renamed" },
    { label: "rejection_reason_policy=required", body: { rejection_reason_policy: "required" }, check: (o) => o.rejection_reason_policy === "required" },
    { label: "skip_decision_comment=true", body: { skip_decision_comment: true }, check: (o) => o.skip_decision_comment === true },
    { label: "sla_config", body: { sla_config: { low: 2880, medium: 1440, high: 240, critical: 60 } }, check: (o) => o.sla_config?.low === 2880 && o.sla_config?.critical === 60 },
    { label: "bottleneck_threshold=42", body: { bottleneck_threshold: 42 }, check: (o) => o.bottleneck_threshold === 42 },
    { label: "bottleneck_alert_enabled=true", body: { bottleneck_alert_enabled: true }, check: (o) => o.bottleneck_alert_enabled === true },
    { label: "ip_allowlist", body: { ip_allowlist: ["203.0.113.1", "198.51.100.0/24"] }, check: (o) => Array.isArray(o.ip_allowlist) && o.ip_allowlist.length === 2 },
    { label: "geo_restrictions", body: { geo_restrictions: { enabled: true, allowed_countries: ["US", "CA"] } }, check: (o) => o.geo_restrictions?.enabled === true && o.geo_restrictions?.allowed_countries?.length === 2 },
    { label: "require_reauth_for_critical=true", body: { require_reauth_for_critical: true }, check: (o) => o.require_reauth_for_critical === true },
    { label: "session_timeout_minutes=60", body: { session_timeout_minutes: 60 }, check: (o) => o.session_timeout_minutes === 60 },
    { label: "four_eyes_config enable", body: { four_eyes_config: { enabled: true, action_types: [], min_priority: "high" } }, check: (o) => o.four_eyes_config?.enabled === true && o.four_eyes_config?.min_priority === "high" },
    { label: "allow_self_approval=true (reconfirm)", body: { allow_self_approval: true }, check: (o) => o.allow_self_approval === true },
    { label: "rejection_presets", body: { rejection_presets: ["Out of budget", "Duplicate", "Needs more info"] }, check: (o) => Array.isArray(o.rejection_presets) && o.rejection_presets.length === 3 },
    { label: "escalation_config disabled/empty", body: { escalation_config: { enabled: false, levels: [] } }, check: (o) => o.escalation_config?.enabled === false && Array.isArray(o.escalation_config?.levels) },
  ];

  for (const p of payloads) {
    const resp = await page.request.patch(`${BASE}/api/v1/org`, {
      data: p.body,
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    });
    const json = await resp.json().catch(() => ({}));
    const org = sqlGetOrg();
    const apiOk = resp.ok();
    const dbOk = p.check(org);
    log({
      phase,
      step: `PATCH ${p.label}`,
      status: apiOk && dbOk ? "pass" : "fail",
      detail: `http=${resp.status()} apiResponseOk=${!!json.data} dbCheck=${dbOk}`,
    });
  }

  // Restore sane defaults so the UI audit isn't staring at restrictive state
  const resetResp = await page.request.patch(`${BASE}/api/v1/org`, {
    data: {
      name: "Claude Audit Tester's Organization",
      rejection_reason_policy: "optional",
      skip_decision_comment: false,
      require_reauth_for_critical: false,
      ip_allowlist: [],
      geo_restrictions: { enabled: false, allowed_countries: [] },
      four_eyes_config: { enabled: false, action_types: [], min_priority: null },
      allow_self_approval: false,
      bottleneck_alert_enabled: false,
    },
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
  });
  log({
    phase,
    step: "reset to defaults",
    status: resetResp.ok() ? "pass" : "warn",
    detail: `http=${resetResp.status()}`,
  });

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
