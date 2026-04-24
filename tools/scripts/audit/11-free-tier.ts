// Audit 11: Free-tier billing gates.
//   a) API: POST to each plan-gated route; expect 403 with PLAN_LIMIT_EXCEEDED.
//   b) UI: visit each page that advertises a TierLimitBanner; confirm the
//      banner element actually renders (not dismissed via localStorage).

import { openBrowser, log, snap, BASE } from "./harness";

const API_PROBES: Array<{ label: string; method: "POST"; path: string; body: any }> = [
  { label: "rules", method: "POST", path: "/api/v1/rules", body: { name: "gate-test", conditions: {}, action: "auto_approve" } },
  { label: "oauth_clients", method: "POST", path: "/api/v1/oauth/clients", body: { name: "gate-test", redirect_uris: ["https://example.com/cb"] } },
  { label: "custom_roles", method: "POST", path: "/api/v1/custom-roles", body: { key: "reviewer", label: "Reviewer", description: "" } },
  { label: "bulk_rules", method: "POST", path: "/api/v1/bulk-rules", body: { name: "gate-test", description: "", conditions: {}, action: "approve" } },
  { label: "trust", method: "POST", path: "/api/v1/trust", body: { connection_id: "00000000-0000-0000-0000-000000000000" } },
  { label: "sso", method: "POST", path: "/api/v1/settings/sso", body: { entity_id: "gate-test", sso_url: "https://example.com/sso" } },
  { label: "analytics_cod", method: "GET" as any, path: "/api/v1/analytics/cost-of-delay", body: undefined },
  { label: "analytics_patterns", method: "GET" as any, path: "/api/v1/analytics/patterns", body: undefined },
];

const UI_PAGES = [
  { path: "/requests/rules", label: "rules" },
  { path: "/requests/audit-log", label: "audit-log" },
  { path: "/requests/connections", label: "connections" },
  { path: "/requests/messaging", label: "messaging" },
  { path: "/org/members", label: "members" },
  { path: "/org/roles", label: "roles" },
];

async function main() {
  const phase = "Audit 11 (free tier)";
  const { browser, context, page } = await openBrowser();
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const H = { "Content-Type": "application/json", Cookie: cookieHeader };

  // ---- API gates ----
  for (const p of API_PROBES) {
    const method = (p.method as string).toUpperCase() === "GET" ? "GET" : "POST";
    const resp = method === "GET"
      ? await page.request.get(`${BASE}${p.path}`, { headers: H })
      : await page.request.post(`${BASE}${p.path}`, { data: p.body, headers: H });
    const text = await resp.text();
    let body: any = {}; try { body = JSON.parse(text); } catch {}
    const is403 = resp.status() === 403;
    const correctCode = body.code === "PLAN_LIMIT_EXCEEDED" || /plan|upgrade|pro|business|enterprise/i.test(body.error ?? body.message ?? "");
    log({
      phase,
      step: `${method} ${p.path} (${p.label})`,
      status: is403 && correctCode ? "pass" : "warn",
      detail: `http=${resp.status()} code=${body.code ?? "?"} err="${(body.error ?? body.message ?? "").toString().slice(0,80)}"`,
    });
  }

  // Teams multi-team: org starts with 1 default team. Creating a second team
  // should be blocked on free.
  {
    const resp = await page.request.post(`${BASE}/api/v1/teams`, {
      data: { name: "free-gate-team" },
      headers: H,
    });
    const body = await resp.json().catch(() => ({}));
    log({
      phase,
      step: "POST /api/v1/teams (2nd team)",
      status: resp.status() === 403 ? "pass" : "warn",
      detail: `http=${resp.status()} code=${body.code ?? "?"}`,
    });
  }

  // ---- UI banners ----
  // Pre-clear localStorage so any prior dismissal doesn't hide banners.
  await page.addInitScript(() => {
    try {
      const keys = Object.keys(localStorage).filter((k) => k.startsWith("okrunit:") && k.endsWith("-dismissed"));
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {}
  });

  for (const p of UI_PAGES) {
    await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const banner = page.locator('text=/Free plan:/i').first();
    const bannerVisible = await banner.isVisible({ timeout: 3000 }).catch(() => false);
    const upgradeLink = page.locator('text=/Upgrade your plan/i').first();
    const linkVisible = await upgradeLink.isVisible({ timeout: 1000 }).catch(() => false);
    const shot = await snap(page, `11-${p.label}`);
    log({
      phase,
      step: `banner on ${p.path}`,
      status: bannerVisible && linkVisible ? "pass" : "warn",
      detail: `banner=${bannerVisible} link=${linkVisible}`,
      screenshot: shot,
    });
  }

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
