import { test, type Page } from "@playwright/test";

// Mobile viewport: iPhone 14
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// Test credentials. Set via env vars:
//   E2E_EMAIL=your@email.com E2E_PASSWORD=yourpassword npx playwright test e2e/mobile-screenshots.spec.ts
const E2E_EMAIL = process.env.E2E_EMAIL ?? "";
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "";

const SCREENSHOT_DIR = "e2e/screenshots/mobile";

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

test.describe("Mobile screenshots - public pages", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test("landing page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "01-landing");
  });

  test("login page", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "02-login");
  });

  test("signup page", async ({ page }) => {
    await page.goto("/signup");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "03-signup");
  });

  test("docs page", async ({ page }) => {
    await page.goto("/docs");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "04-docs");
  });
});

test.describe("Mobile screenshots - authenticated pages", () => {
  test.use({ viewport: MOBILE_VIEWPORT });

  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Set E2E_EMAIL and E2E_PASSWORD env vars to run authenticated tests");

  test.beforeEach(async ({ page }) => {
    // Log in
    await page.goto("/login");
    await page.fill('input[type="email"]', E2E_EMAIL);
    await page.fill('input[type="password"]', E2E_PASSWORD);
    await page.click('button[type="submit"]');
    // Wait for redirect to org overview
    await page.waitForURL(/\/(org|dashboard)/, { timeout: 15000 });
  });

  test("org overview", async ({ page }) => {
    await page.goto("/org/overview");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "10-org-overview");
  });

  test("org members", async ({ page }) => {
    await page.goto("/org/members");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "11-org-members");
  });

  test("org invites", async ({ page }) => {
    await page.goto("/org/invites");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "12-org-invites");
  });

  test("org teams", async ({ page }) => {
    await page.goto("/org/teams");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "13-org-teams");
  });

  test("org organization", async ({ page }) => {
    await page.goto("/org/organization");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "14-org-organization");
  });

  test("requests", async ({ page }) => {
    await page.goto("/requests");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "20-requests");
  });

  test("connections", async ({ page }) => {
    await page.goto("/connections");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "30-connections");
  });

  test("routes", async ({ page }) => {
    await page.goto("/routes");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "31-routes");
  });

  test("settings", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "40-settings");
  });

  test("billing", async ({ page }) => {
    await page.goto("/billing");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "50-billing");
  });

  test("playground", async ({ page }) => {
    await page.goto("/playground");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "60-playground");
  });

  test("analytics", async ({ page }) => {
    await page.goto("/analytics");
    await page.waitForLoadState("networkidle");
    await screenshot(page, "70-analytics");
  });

  // Mobile sidebar drawer test
  test("mobile sidebar opens", async ({ page }) => {
    await page.goto("/org/overview");
    await page.waitForLoadState("networkidle");
    // Click the mobile menu button
    const menuButton = page.locator("button").filter({ has: page.locator('svg.lucide-menu') });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await page.waitForTimeout(300); // Wait for animation
      await screenshot(page, "80-mobile-sidebar");
    }
  });
});
