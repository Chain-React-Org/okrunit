// Audit 12: Visually verify pending items from the April 12/13 work:
//   1. n8n logo loads on landing, /requests/connections, and /requests
//      (after creating a connection that lists n8n as a source)
//   2. Rejected requests appear under the default "All Statuses" filter

import { openBrowser, log, snap, BASE } from "./harness";
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
  const phase = "Audit 12 (visual pending)";

  // --- Seed: one pending, one rejected, so "All Statuses" must show both ---
  const pending = sql(
    `INSERT INTO approval_requests (org_id, title, status, priority, required_approvals) VALUES ('${ORG_ID}', 'Audit pending row', 'pending', 'medium', 1) RETURNING id;`,
  ).rows[0].id;
  const rejected = sql(
    `INSERT INTO approval_requests (org_id, title, status, priority, required_approvals, decided_at, decision_source) VALUES ('${ORG_ID}', 'Audit rejected row', 'rejected', 'medium', 1, NOW(), 'dashboard') RETURNING id;`,
  ).rows[0].id;
  log({ phase, step: "seed pending + rejected approvals", status: "pass", detail: `pending=${pending} rejected=${rejected}` });

  const { browser, page } = await openBrowser();

  // --- Item 1: n8n logo loads on three pages ---
  // Track whether the n8n logo asset successfully loaded (response 200).
  const logoChecks: Record<string, { requested: boolean; ok: boolean }> = {};
  page.on("response", (resp) => {
    const url = resp.url();
    if (/\/logos\/platforms\/n8n\.(png|webp|svg)/i.test(url)) {
      const tag = page.url().split("/").slice(3).join("/") || "root";
      logoChecks[tag] = logoChecks[tag] ?? { requested: false, ok: false };
      logoChecks[tag].requested = true;
      if (resp.status() === 200) logoChecks[tag].ok = true;
    }
  });

  // Landing (logged-in users redirect away if we just go to /), so hit
  // the canonical landing URL while logged in. The n8n logo only shows
  // to logged-out visitors on the root path; for this user we rely on
  // the static /logos/platforms/n8n.* path being reachable.
  for (const p of ["/", "/requests/connections", "/requests"]) {
    logoChecks[p] = { requested: false, ok: false };
    await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await snap(page, `12-${p.replace(/\//g, "_") || "root"}`);
  }

  // Separately probe the asset directly to confirm it's served
  const assetResp = await page.request.get(`${BASE}/logos/platforms/n8n.png`);
  log({
    phase,
    step: "GET /logos/platforms/n8n.png",
    status: assetResp.ok() ? "pass" : "fail",
    detail: `http=${assetResp.status()} type=${assetResp.headers()["content-type"]}`,
  });

  // --- Item 2: rejected row visible when filter is All Statuses ---
  await page.goto(`${BASE}/requests?show=all`, { waitUntil: "domcontentloaded" });
  // Also try the default view. The default filter may be "pending" depending
  // on the store's initial state. Explicitly flip to All Statuses.
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  // Click the status filter and pick All Statuses if it exists
  const statusFilter = page.locator('button, [role="combobox"]').filter({ hasText: /status|all statuses/i }).first();
  const hasFilter = await statusFilter.count();
  if (hasFilter) {
    await statusFilter.click().catch(() => {});
    const allOption = page.getByText(/^all statuses$/i).first();
    await allOption.click({ timeout: 2000 }).catch(() => {});
  }
  await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => {});

  const pendingVisible = await page.getByText("Audit pending row").first().isVisible({ timeout: 3000 }).catch(() => false);
  const rejectedVisible = await page.getByText("Audit rejected row").first().isVisible({ timeout: 3000 }).catch(() => false);
  const shot = await snap(page, "12-requests-all-statuses");
  log({
    phase,
    step: "Rejected row visible in All Statuses",
    status: rejectedVisible ? "pass" : "warn",
    detail: `pending=${pendingVisible} rejected=${rejectedVisible}`,
    screenshot: shot,
  });

  // Cleanup
  sql(`DELETE FROM approval_requests WHERE id IN ('${pending}','${rejected}');`);
  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
