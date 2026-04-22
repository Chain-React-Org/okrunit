import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

test.describe("Onboarding Tour", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.describe.configure({ timeout: 120000 });
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Need E2E credentials");

  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', E2E_EMAIL!);
    await page.fill('input[type="password"]', E2E_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(org|dashboard|setup)/, { timeout: 30000 });
    await page.waitForTimeout(1000);

    // Clear tour state after we're on a page with localStorage access
    await page.evaluate(() => {
      localStorage.removeItem("okrunit-onboarding-tour");
    });
    await page.goto("/org/overview", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
  });

  test.afterEach(async ({ page }) => {
    // Clean up test data and tour state
    await page.evaluate(async () => {
      localStorage.removeItem("okrunit-onboarding-tour");
      try {
        await fetch("/api/v1/onboarding", { method: "DELETE" });
      } catch {}
    });
  });

  test("tour tooltip is visible and within viewport on each step", async ({ page }) => {
    // Start the tour
    const startButton = page.locator("text=Start Tour");
    if (await startButton.isVisible({ timeout: 5000 })) {
      await startButton.click();
    }

    await page.waitForTimeout(2000);

    // Step 1: See request. Should be on /requests
    await page.waitForURL(/\/requests/, { timeout: 10000 });
    const step1Tooltip = page.locator(".z-\\[10000\\]");
    await expect(step1Tooltip).toBeVisible({ timeout: 10000 });

    // Verify tooltip is within viewport
    const box1 = await step1Tooltip.boundingBox();
    expect(box1).not.toBeNull();
    if (box1) {
      expect(box1.x).toBeGreaterThanOrEqual(0);
      expect(box1.y).toBeGreaterThanOrEqual(0);
      expect(box1.x + box1.width).toBeLessThanOrEqual(1280);
      expect(box1.y + box1.height).toBeLessThanOrEqual(800);
    }

    // Click next
    await page.click("text=Next");
    await page.waitForTimeout(1000);

    // Step 2: Approve or Reject
    const step2Tooltip = page.locator(".z-\\[10000\\]");
    await expect(step2Tooltip).toBeVisible({ timeout: 5000 });
    const box2 = await step2Tooltip.boundingBox();
    if (box2) {
      expect(box2.x).toBeGreaterThanOrEqual(0);
      expect(box2.x + box2.width).toBeLessThanOrEqual(1280);
    }

    // Click "I'll try it" to advance
    await page.click("text=I'll try it");
    await page.waitForTimeout(2000);

    // Step 3: Routes
    await page.waitForURL(/\/requests\/routes/, { timeout: 10000 });
    const step3Tooltip = page.locator(".z-\\[10000\\]");
    await expect(step3Tooltip).toBeVisible({ timeout: 10000 });

    await page.click("text=Next");
    await page.waitForTimeout(2000);

    // Step 4: Rules
    await page.waitForURL(/\/requests\/rules/, { timeout: 10000 });
    const step4Tooltip = page.locator(".z-\\[10000\\]");
    await expect(step4Tooltip).toBeVisible({ timeout: 10000 });

    await page.click("text=Next");
    await page.waitForTimeout(2000);

    // Step 5: Connections
    await page.waitForURL(/\/requests\/connections/, { timeout: 10000 });
    const step5Tooltip = page.locator(".z-\\[10000\\]");
    await expect(step5Tooltip).toBeVisible({ timeout: 10000 });

    await page.click("text=Next");
    await page.waitForTimeout(2000);

    // Step 6: Messaging
    await page.waitForURL(/\/requests\/messaging/, { timeout: 10000 });
    const step6Tooltip = page.locator(".z-\\[10000\\]");
    await expect(step6Tooltip).toBeVisible({ timeout: 10000 });

    await page.click("text=Next");
    await page.waitForTimeout(2000);

    // Step 7: Done
    await page.waitForURL(/\/org\/overview/, { timeout: 10000 });
    const step7Tooltip = page.locator(".z-\\[10000\\]");
    await expect(step7Tooltip).toBeVisible({ timeout: 10000 });

    // Finish
    await page.click("text=Finish Tour");
    await page.waitForTimeout(1000);

    // Tooltip should be gone
    await expect(page.locator(".z-\\[10000\\]")).not.toBeVisible();
  });
});

// Mobile viewport test
test.describe("Onboarding Tour (Mobile)", () => {
  test.use({ viewport: { width: 375, height: 812 } }); // iPhone 14
  test.describe.configure({ timeout: 60000 });
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Need E2E credentials");

  test("tour tooltip fits on mobile viewport", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', E2E_EMAIL!);
    await page.fill('input[type="password"]', E2E_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(org|dashboard|setup)/, { timeout: 30000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      localStorage.removeItem("okrunit-onboarding-tour");
    });
    await page.goto("/org/overview", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);

    // Start tour
    const startButton = page.locator("text=Start Tour");
    if (await startButton.isVisible({ timeout: 5000 })) {
      await startButton.click();
    }

    await page.waitForTimeout(3000);

    // Verify tooltip is visible and within mobile viewport
    const tooltip = page.locator(".z-\\[10000\\]");
    await expect(tooltip).toBeVisible({ timeout: 10000 });

    const box = await tooltip.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }

    // Clean up
    await page.click("text=Skip tour");
    await page.evaluate(async () => {
      localStorage.removeItem("okrunit-onboarding-tour");
      try { await fetch("/api/v1/onboarding", { method: "DELETE" }); } catch {}
    });
  });
});
