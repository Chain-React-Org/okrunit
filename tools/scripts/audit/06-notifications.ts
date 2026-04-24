// Audit 6: Notification routing.
//   a) Unit-level: exercise getNotificationHref() over all branches.
//   b) Integration: seed an in-app notification, open the bell, click it,
//      verify we land on the correct URL.

import { openBrowser, snap, log, BASE } from "./harness";
import { getNotificationHref } from "@/lib/notifications/href";
import * as fs from "fs";
import { execSync } from "child_process";

const USER_ID = fs.readFileSync("/tmp/claude-audit/user_id", "utf8").trim();
const ORG_ID = fs.readFileSync("/tmp/claude-audit/org_id", "utf8").trim();

function sql(query: string): any {
  const tmp = "/tmp/claude-audit/.q.sql";
  fs.writeFileSync(tmp, query);
  const out = execSync(
    `cd /Users/nathanielstoddard/okrunit && npx supabase db query --linked "$(cat ${tmp})"`,
    { encoding: "utf8", shell: "/bin/bash" },
  );
  const startIdx = out.indexOf("{");
  return JSON.parse(out.slice(startIdx, out.lastIndexOf("}") + 1));
}

async function main() {
  const phase = "Audit 6 (notifications)";

  // ---- Unit tests on href resolver ----
  const unitCases: Array<[any, string]> = [
    [{ resource_type: "approval_flow", resource_id: "flow-1" }, "/requests/routes?flow=flow-1"],
    [{ resource_type: "approval_request", resource_id: "req-1" }, "/requests?open=req-1"],
    [{ resource_type: "team", resource_id: "team-1" }, "/org/teams/team-1"],
    [{ resource_type: "connection" }, "/requests/connections"],
    [{ resource_type: "org_invite" }, "/org/members"],
    [{ resource_type: "approval_delegation", resource_id: "d-1" }, "/settings/delegation"],
    [{ category: "delegation_received" }, "/settings/delegation"],
    [{ category: "delegation_expiring" }, "/settings/delegation"],
    [{ category: "limit_approaching" }, "/org/billing"],
    [{ category: "billing" }, "/org/billing"],
    [{ category: "role_changed" }, "/settings/account"],
    [{}, "/requests"], // fallback
  ];
  for (const [input, expected] of unitCases) {
    const actual = getNotificationHref(input);
    log({
      phase,
      step: `href ${JSON.stringify(input)}`,
      status: actual === expected ? "pass" : "fail",
      detail: `expected=${expected} actual=${actual}`,
    });
  }

  // ---- Integration: seed notification, click it ----
  // Create a plain notification that routes to /settings/delegation (category: delegation_received)
  const seeded = sql(
    `INSERT INTO in_app_notifications (org_id, user_id, category, title, body) VALUES ('${ORG_ID}', '${USER_ID}', 'delegation_received', 'Audit delegation test', 'seeded') RETURNING id;`,
  );
  const notifId = seeded.rows[0].id;
  log({ phase, step: "seed notification", status: "pass", detail: `id=${notifId}` });

  const { browser, page } = await openBrowser();

  // Go anywhere logged-in; we'll open the bell
  await page.goto(`${BASE}/org/overview`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  // Click the bell by aria label
  const bell = page.getByRole("button", { name: /notifications?/i }).first();
  await bell.click({ trial: false }).catch(async () => {
    // Some components use aria-label "Open notifications" or similar
    const alt = page.locator('[aria-label*="Notifications" i]').first();
    await alt.click();
  });

  await snap(page, "06-bell-open");

  // Wait for the panel to contain our seeded notification
  const notifEntry = page.getByText("Audit delegation test", { exact: false }).first();
  const visible = await notifEntry.waitFor({ state: "visible", timeout: 8000 }).then(() => true).catch(() => false);
  log({
    phase,
    step: "bell panel shows seeded notification",
    status: visible ? "pass" : "fail",
  });

  if (visible) {
    const navPromise = page.waitForURL(/\/settings\/delegation/, { timeout: 8000 }).then(() => true).catch(() => false);
    await notifEntry.click();
    const navigated = await navPromise;
    await snap(page, "06-after-click");
    log({
      phase,
      step: "click routes to /settings/delegation",
      status: navigated ? "pass" : "fail",
      detail: `url=${page.url()}`,
    });
  }

  // Cleanup
  sql(`DELETE FROM in_app_notifications WHERE id = '${notifId}';`);
  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
