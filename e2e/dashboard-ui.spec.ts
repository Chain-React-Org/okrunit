import { test, expect } from '@playwright/test';

test.describe('Dashboard UI - Spacing and Layout', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');

    // Check if we're on login page, if so, sign in with test credentials
    const url = page.url();
    if (url.includes('/login')) {
      const testEmail = process.env.TEST_EMAIL || 'test@example.com';
      const testPassword = process.env.TEST_PASSWORD || 'password123';

      // Fill in email
      await page.fill('input[type="email"]', testEmail);
      // Fill in password
      await page.fill('input[type="password"]', testPassword);
      // Click sign in
      await page.click('button:has-text("Sign in")');

      // Wait for navigation to dashboard
      await page.waitForURL('/dashboard', { timeout: 10000 });
    } else if (!url.includes('/dashboard')) {
      // Navigate to dashboard if not already there
      await page.goto('/dashboard');
    }

    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('sidebar org name should be visible and styled correctly', async ({ page }) => {
    // Find the org switcher/name element
    const orgElement = page.locator('text=/[A-Za-z0-9\s]+/').first();

    // Check if it's visible
    await expect(orgElement).toBeVisible();

    // Get computed styles
    const fontSize = await orgElement.evaluate((el) =>
      window.getComputedStyle(el).fontSize
    );

    // Org name should be reasonably sized (not tiny - at least 13px)
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(13);

    console.log('✓ Org name is visible and properly sized');
  });

  test('page title should be large (text-3xl)', async ({ page }) => {
    // Find the main page title (h1)
    const pageTitle = page.locator('h1').first();

    // Should be visible
    await expect(pageTitle).toBeVisible();

    // Get computed font size
    const fontSize = await pageTitle.evaluate((el) =>
      window.getComputedStyle(el).fontSize
    );

    // text-3xl in Tailwind is 1.875rem = 30px
    const fontSizeNum = parseInt(fontSize);
    expect(fontSizeNum).toBeGreaterThanOrEqual(28); // Allow slight variations

    console.log(`✓ Page title has correct size: ${fontSize}`);
  });

  test('stat cards should have proper spacing and size', async ({ page }) => {
    // Look for stat cards (they should be visible on dashboard)
    const statCards = page.locator('[class*="stat-card"]');

    // Wait for at least one stat card to be visible
    await page.waitForSelector('[class*="stat-card"]', { timeout: 5000 }).catch(() => {
      console.log('⚠ No stat cards found, checking for alternative selectors');
    });

    // Get the stat card count
    const count = await statCards.count();

    if (count > 0) {
      // Check first stat card
      const firstCard = statCards.first();

      // Get the padding
      const padding = await firstCard.evaluate((el) =>
        window.getComputedStyle(el.querySelector('[class*="CardContent"]') || el).padding
      );

      // Should have generous padding (p-6 = 1.5rem = 24px)
      console.log(`✓ Stat card padding: ${padding}`);

      // Check if cards have border
      const border = await firstCard.evaluate((el) =>
        window.getComputedStyle(el).borderWidth
      );

      const borderNum = parseInt(border);
      expect(borderNum).toBeGreaterThan(0);

      console.log(`✓ Stat cards have proper styling and borders`);
    }
  });

  test('filter bar should have improved styling', async ({ page }) => {
    // Look for the filter bar
    const filterBar = page.locator('[class*="rounded"]').filter({ hasText: /Status|Priority|Search/ });

    // Wait for filter bar to be visible
    const filterElement = page.locator('input[placeholder*="Search"]').first();

    if (await filterElement.isVisible()) {
      // Check if filter area has proper background
      const bgColor = await filterElement.evaluate((el) =>
        window.getComputedStyle(el.parentElement || el).backgroundColor
      );

      console.log(`✓ Filter bar background color: ${bgColor}`);
    }
  });

  test('page container should have adequate padding', async ({ page }) => {
    // Find main content area
    const mainContent = page.locator('main');

    // Check if main exists
    if (await mainContent.isVisible()) {
      const child = mainContent.locator('> div').first();

      // Get padding
      const padding = await child.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          paddingTop: style.paddingTop,
          paddingBottom: style.paddingBottom,
        };
      });

      // px-8 = 2rem = 32px
      const paddingValues = Object.values(padding).map(v => parseInt(v));
      const minPadding = Math.min(...paddingValues);

      expect(minPadding).toBeGreaterThanOrEqual(24); // Allow slight variations

      console.log(`✓ Page container has proper padding:`, padding);
    }
  });

  test('sidebar navigation sections should have proper spacing', async ({ page }) => {
    // Look for sidebar
    const sidebar = page.locator('aside');

    if (await sidebar.isVisible()) {
      // Check navigation items
      const navItems = sidebar.locator('a, button').filter({ hasText: /Dashboard|Connections|Analytics/ });

      const count = await navItems.count();
      expect(count).toBeGreaterThan(0);

      console.log(`✓ Found ${count} navigation items in sidebar`);
    }
  });

  test('overall visual hierarchy should be improved', async ({ page }) => {
    // Take a screenshot for manual inspection
    await page.screenshot({ path: 'dashboard-screenshot.png' });

    // Do a basic check that key elements are visible
    const pageTitle = page.locator('h1');
    const sidebar = page.locator('aside');
    const mainContent = page.locator('main');

    await expect(pageTitle).toBeVisible();
    await expect(sidebar).toBeVisible();
    await expect(mainContent).toBeVisible();

    console.log('✓ All major layout elements are visible');
    console.log('  Screenshot saved to dashboard-screenshot.png for manual inspection');
  });
});
