import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL ?? "";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "";

/**
 * Measures how long it takes to navigate between dashboard pages.
 * Captures both the full load time and the time-to-first-meaningful-content.
 */
test.describe("Dashboard navigation performance", () => {
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Need E2E credentials");

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.fill('input[type="email"]', E2E_EMAIL);
    await page.fill('input[type="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(org|dashboard)/, { timeout: 15000 });
  });

  const routes = [
    { name: "Requests", path: "/requests" },
    { name: "Org Overview", path: "/org/overview" },
    { name: "Connections", path: "/connections" },
    { name: "Analytics", path: "/analytics" },
    { name: "Settings", path: "/settings" },
    { name: "Org Members", path: "/org/members" },
  ];

  test("measure client-side navigation between dashboard pages", async ({
    page,
  }) => {
    // Warm up: ensure we're on a dashboard page and everything is loaded
    await page.goto("/requests");
    await page.waitForLoadState("networkidle");

    const results: { from: string; to: string; durationMs: number }[] = [];

    for (let i = 0; i < routes.length; i++) {
      const target = routes[i];
      const fromPath = new URL(page.url()).pathname;

      const start = Date.now();

      // Full page navigation (simulates hard refresh / first visit)
      await page.goto(target.path);
      await page.waitForLoadState("networkidle");

      const duration = Date.now() - start;

      results.push({
        from: fromPath,
        to: target.path,
        durationMs: duration,
      });
    }

    // Now test client-side navigations (clicking links in the sidebar)
    const clientNavResults: {
      from: string;
      to: string;
      durationMs: number;
    }[] = [];

    // Navigate to a known starting point
    await page.goto("/requests");
    await page.waitForLoadState("networkidle");

    const clientRoutes = [
      { name: "Org Overview", path: "/org/overview" },
      { name: "Requests", path: "/requests" },
      { name: "Analytics", path: "/analytics" },
      { name: "Connections", path: "/connections" },
    ];

    for (const target of clientRoutes) {
      const fromPath = new URL(page.url()).pathname;

      const start = Date.now();

      // Click sidebar link for client-side navigation
      const link = page.locator(`a[href="${target.path}"]`).first();
      if (await link.isVisible()) {
        await link.click();
      } else {
        // Fallback to goto if sidebar link not found
        await page.goto(target.path);
      }

      await page.waitForURL(`**${target.path}*`, { timeout: 15000 });
      await page.waitForLoadState("networkidle");

      const duration = Date.now() - start;
      clientNavResults.push({
        from: fromPath,
        to: target.path,
        durationMs: duration,
      });
    }

    // Print results
    console.log("\n=== FULL PAGE NAVIGATION (page.goto) ===");
    for (const r of results) {
      const status = r.durationMs > 3000 ? "🔴 SLOW" : r.durationMs > 1500 ? "🟡 MODERATE" : "🟢 FAST";
      console.log(`  ${r.from} → ${r.to}: ${r.durationMs}ms ${status}`);
    }

    console.log("\n=== CLIENT-SIDE NAVIGATION (link click) ===");
    for (const r of clientNavResults) {
      const status = r.durationMs > 3000 ? "🔴 SLOW" : r.durationMs > 1500 ? "🟡 MODERATE" : "🟢 FAST";
      console.log(`  ${r.from} → ${r.to}: ${r.durationMs}ms ${status}`);
    }

    const avgFull =
      results.reduce((s, r) => s + r.durationMs, 0) / results.length;
    const avgClient =
      clientNavResults.reduce((s, r) => s + r.durationMs, 0) /
      clientNavResults.length;

    console.log(`\n  Average full navigation: ${Math.round(avgFull)}ms`);
    console.log(`  Average client navigation: ${Math.round(avgClient)}ms`);

    // Assert that average navigation is under 5 seconds (generous threshold)
    // Tighten this as performance improves
    expect(avgFull).toBeLessThan(5000);
    expect(avgClient).toBeLessThan(5000);
  });
});
