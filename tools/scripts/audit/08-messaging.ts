// Audit 8: Messaging integrations surface-level. Without an actual Slack
// workspace / Teams tenant / Discord bot, we can only verify the
// configuration pages render and the list/connect endpoints respond.
// Actual end-to-end message delivery would need a real workspace.

import { openBrowser, log, snap, BASE } from "./harness";

async function main() {
  const phase = "Audit 8 (messaging)";
  const { browser, context, page } = await openBrowser();
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const H = { "Content-Type": "application/json", Cookie: cookieHeader };

  // List connections
  {
    const resp = await page.request.get(`${BASE}/api/v1/messaging/connections`, { headers: H });
    const body = await resp.json().catch(() => ({}));
    log({
      phase,
      step: "GET /api/v1/messaging/connections",
      status: resp.ok() ? "pass" : "fail",
      detail: `http=${resp.status()} body=${JSON.stringify(body).slice(0,120)}`,
    });
  }

  // OAuth begin flow: /install redirects to the provider's consent URL with
  // 302. Reject redirects so we can inspect the Location header.
  for (const platform of ["slack", "teams", "discord"] as const) {
    const resp = await page.request.get(`${BASE}/api/v1/messaging/${platform}/install`, {
      headers: H,
      maxRedirects: 0,
    });
    const loc = resp.headers()["location"] ?? "";
    const goesToProvider = /slack\.com|microsoftonline\.com|discord\.com/.test(loc);
    log({
      phase,
      step: `/install ${platform} → provider redirect`,
      status: resp.status() === 302 && goesToProvider ? "pass" : "warn",
      detail: `http=${resp.status()} location=${loc.slice(0, 80)}`,
    });
  }

  // Page renders
  const r = await page.goto(`${BASE}/requests/messaging`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  const shot = await snap(page, "08-messaging-page");
  log({
    phase,
    step: "page /requests/messaging",
    status: r && r.status() === 200 ? "pass" : "fail",
    detail: `http=${r?.status()}`,
    screenshot: shot,
  });

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
