import { test, expect, type Page } from "@playwright/test";

const SCREENSHOT_DIR = "e2e/screenshots/landing-mobile";

const VIEWPORTS = {
  "iphone-se": { width: 375, height: 667 },
  "iphone-14": { width: 390, height: 844 },
  "iphone-14-pro-max": { width: 430, height: 932 },
  "pixel-7": { width: 412, height: 915 },
  "ipad-mini": { width: 768, height: 1024 },
  "galaxy-fold": { width: 280, height: 653 },
} as const;

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${SCREENSHOT_DIR}/${name}.png`,
    fullPage: true,
  });
}

for (const [device, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`Landing page - ${device} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test("full page screenshot", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");
      await screenshot(page, `${device}-full`);
    });

    test("no horizontal overflow", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Check that no element causes horizontal scroll
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // 1px tolerance
    });

    test("hero section visible and readable", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Check hero heading is visible
      const heading = page.locator("h1");
      await expect(heading).toBeVisible();

      // Check CTA buttons are visible
      const ctaButtons = page.locator("#hero a[href='/signup'], #hero a[href='/docs']");
      const buttonCount = await ctaButtons.count();
      expect(buttonCount).toBeGreaterThanOrEqual(1);
    });

    test("mobile menu button visible on small screens", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      if (viewport.width < 1024) {
        // Mobile menu button should be visible
        const menuButton = page.locator("button").filter({ hasText: /Open menu/i }).or(
          page.locator("header button svg.lucide-menu").locator("..")
        );
        await expect(menuButton.first()).toBeVisible();

        // Click to open
        await menuButton.first().click();
        await page.waitForTimeout(300);

        // Navigation links should now be visible in the sheet
        const docsLink = page.locator("[role='dialog'] a[href='/docs']");
        await expect(docsLink).toBeVisible();

        await screenshot(page, `${device}-menu-open`);
      }
    });

    test("integration marquee renders", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Check that marquee items exist
      const marqueeItems = page.locator("text=Zapier").first();
      await expect(marqueeItems).toBeAttached();
    });

    test("feature sections render on mobile", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Scroll to each feature section and check it renders
      for (const id of ["approvals", "queue", "routing", "audit"]) {
        const section = page.locator(`#${id}`);
        if (await section.count() > 0) {
          await section.scrollIntoViewIfNeeded();
          await expect(section).toBeVisible();
        }
      }
    });

    test("footer renders properly", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      const footer = page.locator("footer");
      await footer.scrollIntoViewIfNeeded();
      await expect(footer).toBeVisible();

      // Check footer links
      const docsLink = footer.locator("a[href='/docs']");
      await expect(docsLink).toBeVisible();
    });
  });
}
