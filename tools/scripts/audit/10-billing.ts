// Audit 10: Billing surfaces. Read-only probes only; no real payments.

import { openBrowser, log, snap, BASE } from "./harness";

async function main() {
  const phase = "Audit 10 (billing)";
  const { browser, context, page } = await openBrowser();
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const H = { "Content-Type": "application/json", Cookie: cookieHeader };

  const endpoints = [
    "/api/v1/billing/usage",
    "/api/v1/billing/usage-alerts",
    "/api/v1/billing/payment-methods",
  ];
  for (const path of endpoints) {
    const resp = await page.request.get(`${BASE}${path}`, { headers: H });
    log({
      phase,
      step: `GET ${path}`,
      status: resp.ok() ? "pass" : "warn",
      detail: `http=${resp.status()}`,
    });
  }

  // Page renders
  const pages = ["/org/billing", "/org/subscription", "/org/payments"];
  for (const p of pages) {
    const r = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const shot = await snap(page, `10${p.replace(/\//g, "_")}`);
    log({
      phase,
      step: `page ${p}`,
      status: r && r.status() === 200 ? "pass" : "fail",
      detail: `http=${r?.status()} finalUrl=${page.url()}`,
      screenshot: shot,
    });
  }

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
