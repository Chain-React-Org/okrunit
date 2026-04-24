// Audit 1: Nav + route smoke. Visit each top-level dashboard route,
// check response status, body length, and filter out known benign noise.

import { openBrowser, snap, log, errorCursor, errorsSince, BASE } from "./harness";

const ROUTES = [
  // Org area
  "/org/overview",
  "/org/settings",
  "/org/members",
  "/org/billing",
  "/org/invites",
  "/org/roles",
  "/org/teams",
  "/org/organizations",
  "/org/subscription",
  "/org/payments",
  "/org/sso",
  // Requests area
  "/requests",
  "/requests/routes",
  "/requests/templates",
  "/requests/rules",
  "/requests/connections",
  "/requests/messaging",
  "/requests/notifications",
  "/requests/audit-log",
  "/requests/sla",
  "/requests/analytics",
  // Personal settings
  "/settings",
  "/settings/account",
  "/settings/calendar",
  "/settings/delegation",
  "/settings/notifications",
  "/settings/oauth",
  "/settings/safety",
  // Playground
  "/playground",
  "/playground/request-builder",
  "/playground/webhook-deliveries",
];

// Benign patterns we filter out from error counts
const NOISE_PATTERNS = [
  /cloudflareinsights/,
  /_rsc=/,                              // RSC prefetch aborts during nav are normal
  /net::ERR_ABORTED/,                   // subscriptions torn down on navigation
  /Minified React error #419/,          // React transient "interrupted" error in strict nav
  /Failed to load resource: the server responded with a status of 404$/, // raw 404 log; actual URL is captured by response hook
  /gravatar\.com\/avatar\/.*d=404/,     // app uses ?d=404 to detect missing avatars (intentional)
];

function filterNoise(errs: string[]): string[] {
  return errs.filter((e) => !NOISE_PATTERNS.some((p) => p.test(e)));
}

async function main() {
  const { browser, page } = await openBrowser();
  const phase = "Audit 1 (nav)";
  const summary: Record<string, number> = { pass: 0, fail: 0, warn: 0 };

  for (const route of ROUTES) {
    const errStart = errorCursor(page);
    const url = `${BASE}${route}`;
    let status = 0;
    let finalUrl = "";
    try {
      const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
      status = resp?.status() ?? 0;
      finalUrl = page.url();
    } catch (e) {
      log({ phase, step: `GET ${route}`, status: "fail", detail: `nav error: ${(e as Error).message}` });
      summary.fail++;
      continue;
    }

    const bodyText = (await page.textContent("body").catch(() => ""))?.trim() || "";
    const errsRaw = errorsSince(page, errStart);
    const errs = filterNoise(errsRaw);
    const shot = await snap(page, `01${route.replace(/\//g, "_") || "_root"}`);
    let s: "pass" | "fail" | "warn" = "pass";
    let detail = `${status} → ${finalUrl}`;
    if (status >= 400) s = "fail";
    else if (bodyText.length < 80) { s = "warn"; detail += ` (body ${bodyText.length}c)`; }
    if (errs.length) { s = s === "pass" ? "warn" : s; detail += ` | ${errs.length} real errors`; }
    log({ phase, step: `GET ${route}`, status: s, detail, screenshot: shot });
    summary[s]++;
    for (const e of errs) log({ phase, step: `${route} error`, status: "warn", detail: e });
  }

  // /setup after completion -- should redirect (or at least be safe to visit)
  {
    await page.goto(`${BASE}/setup`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const after = page.url();
    log({
      phase,
      step: "GET /setup while setup complete",
      status: after.includes("/setup") ? "warn" : "pass",
      detail: `landed at ${after}`,
    });
  }

  // /login while logged in
  {
    await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 15000 });
    const after = page.url();
    log({
      phase,
      step: "GET /login while logged in",
      status: after.includes("/login") ? "warn" : "pass",
      detail: `landed at ${after}`,
    });
  }

  console.log("\n--- SUMMARY ---");
  console.log(summary);
  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
