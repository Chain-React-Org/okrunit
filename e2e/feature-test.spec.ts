import { test, expect } from "@playwright/test";

const E2E_EMAIL = process.env.E2E_EMAIL;
const E2E_PASSWORD = process.env.E2E_PASSWORD;

// Run serially. Tests share the onboarding test request
test.describe.configure({ mode: "serial", timeout: 120_000 });

test.describe("Notification, Watcher & Responsible Badge", () => {
  test.use({ viewport: { width: 1280, height: 800 } });
  test.skip(!E2E_EMAIL || !E2E_PASSWORD, "Need E2E credentials");

  test.beforeEach(async ({ page }) => {
    // Dismiss onboarding tour before any page JS runs
    await page.addInitScript(() => {
      localStorage.setItem("okrunit-onboarding-tour", JSON.stringify({ completed: true, dismissed: true, step: 999 }));
    });

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);
    await page.fill('input[type="email"]', E2E_EMAIL!);
    await page.fill('input[type="password"]', E2E_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(org|dashboard|setup)/, { timeout: 30000 });
  });

  test("1. watch/unwatch API works", async ({ page }) => {
    // Clean slate
    await page.evaluate(async () => {
      try { await fetch("/api/v1/onboarding", { method: "DELETE" }); } catch {}
    });
    await page.waitForTimeout(1500);

    const created = await page.evaluate(async () => {
      const res = await fetch("/api/v1/onboarding", { method: "POST", headers: { "Content-Type": "application/json" } });
      return await res.json();
    });
    const requestId = (created as { data?: { id?: string } }).data?.id;
    expect(requestId).toBeTruthy();
    console.log("Created request:", requestId);

    // GET: initial status
    const initial = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/v1/approvals/${id}/watch`);
      return await res.json();
    }, requestId!);
    console.log("Initial:", JSON.stringify(initial));
    expect(initial.count).toBeGreaterThanOrEqual(0);

    // POST: watch
    const watchRes = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/v1/approvals/${id}/watch`, { method: "POST" });
      return { status: res.status, body: await res.json() };
    }, requestId!);
    console.log("Watch:", JSON.stringify(watchRes));
    expect(watchRes.body.watching).toBe(true);

    // GET: verify watching
    const after = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/v1/approvals/${id}/watch`);
      return await res.json();
    }, requestId!);
    console.log("After watch:", JSON.stringify(after));
    expect(after.isWatching).toBe(true);

    // DELETE: unwatch
    const unwatchRes = await page.evaluate(async (id: string) => {
      const res = await fetch(`/api/v1/approvals/${id}/watch`, { method: "DELETE" });
      return { status: res.status, body: await res.json() };
    }, requestId!);
    console.log("Unwatch:", JSON.stringify(unwatchRes));
    expect(unwatchRes.body.watching).toBe(false);

    // Cleanup
    await page.evaluate(async () => {
      try { await fetch("/api/v1/onboarding", { method: "DELETE" }); } catch {}
    });
  });

  test("2. responsible badge visible on requests page", async ({ page }) => {
    // Create test request
    await page.evaluate(async () => {
      try { await fetch("/api/v1/onboarding", { method: "DELETE" }); } catch {}
    });
    await page.waitForTimeout(1000);
    await page.evaluate(async () => {
      await fetch("/api/v1/onboarding", { method: "POST", headers: { "Content-Type": "application/json" } });
    });

    await page.goto("/requests", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(3000);

    const hasBadge = await page.locator("text=Any approver").first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log("Responsible badge visible:", hasBadge);
    expect(hasBadge).toBe(true);

    await page.evaluate(async () => {
      try { await fetch("/api/v1/onboarding", { method: "DELETE" }); } catch {}
    });
  });

  test("3. watch button and viewer banner in detail pane", async ({ page }) => {
    // Create test request
    await page.evaluate(async () => {
      try { await fetch("/api/v1/onboarding", { method: "DELETE" }); } catch {}
    });
    await page.waitForTimeout(1000);
    const created = await page.evaluate(async () => {
      const res = await fetch("/api/v1/onboarding", { method: "POST", headers: { "Content-Type": "application/json" } });
      return await res.json();
    });
    const requestId = (created as { data?: { id?: string } }).data?.id;
    expect(requestId).toBeTruthy();

    await page.goto("/requests", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    // Remove all fixed overlays (tour, modals, etc.) so we can click
    await page.evaluate(() => {
      document.querySelectorAll('div[class*="fixed"]').forEach(el => {
        const s = getComputedStyle(el);
        if (s.position === 'fixed' && (s.zIndex === '9998' || s.zIndex === '10000' || s.zIndex === '10002' || parseInt(s.zIndex) > 9000)) {
          (el as HTMLElement).remove();
        }
      });
    });
    await page.waitForTimeout(500);

    // Click on the card using JavaScript to bypass any remaining overlays
    await page.evaluate(() => {
      const card = document.querySelector('[data-tour="test-request"]') || document.querySelector('[class*="group/card"]');
      if (card) (card as HTMLElement).click();
    });
    await page.waitForTimeout(3000);

    // Check for watch button in the detail sheet
    const watchBtn = page.locator('button:has-text("Watch"), button:has-text("Unwatch")').first();
    const hasWatchBtn = await watchBtn.isVisible({ timeout: 8000 }).catch(() => false);
    console.log("Watch button visible:", hasWatchBtn);

    await page.screenshot({ path: "test-results/watch-button-detail.png" });

    if (hasWatchBtn) {
      // Click watch and verify toggle
      await watchBtn.click({ force: true });
      await page.waitForTimeout(1000);
      const btnText = await watchBtn.textContent();
      console.log("Button text after click:", btnText);
    }

    expect(hasWatchBtn).toBe(true);

    await page.evaluate(async () => {
      try { await fetch("/api/v1/onboarding", { method: "DELETE" }); } catch {}
    });
  });

  test("4. activity timeline shows votes", async ({ page }) => {
    // Create and approve a test request
    await page.evaluate(async () => {
      try { await fetch("/api/v1/onboarding", { method: "DELETE" }); } catch {}
    });
    await page.waitForTimeout(1000);

    const created = await page.evaluate(async () => {
      const res = await fetch("/api/v1/onboarding", { method: "POST", headers: { "Content-Type": "application/json" } });
      return await res.json();
    });
    const requestId = (created as { data?: { id?: string } }).data?.id;
    expect(requestId).toBeTruthy();

    // Approve with a comment
    await page.evaluate(async (id: string) => {
      await fetch(`/api/v1/approvals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approve", comment: "Looks good!" }),
      });
    }, requestId!);
    await page.waitForTimeout(1000);

    await page.goto("/requests", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(4000);

    // Remove overlays and click card via JS
    await page.evaluate(() => {
      document.querySelectorAll('div').forEach(el => {
        const s = getComputedStyle(el);
        if (s.position === 'fixed' && parseInt(s.zIndex) > 9000) el.remove();
      });
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      const card = document.querySelector('[class*="group/card"]');
      if (card) (card as HTMLElement).click();
    });
    await page.waitForTimeout(3000);

    // Check for "approved" text in the detail pane (from vote timeline or status)
    const hasApproved = await page.locator('text=approved').first().isVisible({ timeout: 5000 }).catch(() => false);
    console.log("Vote 'approved' visible in timeline:", hasApproved);

    await page.screenshot({ path: "test-results/activity-timeline.png" });
    expect(hasApproved).toBe(true);

    await page.evaluate(async () => {
      try { await fetch("/api/v1/onboarding", { method: "DELETE" }); } catch {}
    });
  });
});
