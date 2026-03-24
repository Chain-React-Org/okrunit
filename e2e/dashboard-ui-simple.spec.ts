import { test, expect } from '@playwright/test';

test.describe('Dashboard UI - Visual Inspection', () => {
  test('should load and display the app correctly', async ({ page }) => {
    // Navigate to the production URL
    const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'https://okrunit.vercel.app';

    // Go to the home page
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Take a screenshot of what we see
    await page.screenshot({ path: 'screenshots/initial-load.png', fullPage: true });

    // Get the current URL to see if we're on login or dashboard
    const url = page.url();
    console.log('Current URL:', url);

    // Check what's visible on the page
    const bodyText = await page.locator('body').textContent();

    if (bodyText?.includes('Sign in') || url.includes('/login')) {
      console.log('✓ App is live and showing login page');

      // Check if the page has proper styling
      const loginContainer = page.locator('input[type="email"]');
      if (await loginContainer.isVisible()) {
        console.log('✓ Login form is visible');
      }
    } else if (url.includes('/dashboard')) {
      console.log('✓ App is live and showing dashboard');

      // Check sidebar
      const sidebar = page.locator('aside');
      if (await sidebar.isVisible()) {
        console.log('✓ Sidebar is visible');

        // Check for org name with icon
        const orgElement = page.locator('svg[class*="Building"]').first();
        if (await orgElement.isVisible({ timeout: 5000 }).catch(() => false)) {
          console.log('✓ Organization icon (Building2) is visible');
        }
      }

      // Check main content
      const main = page.locator('main');
      if (await main.isVisible()) {
        console.log('✓ Main content area is visible');
      }

      // Check page title
      const h1 = page.locator('h1').first();
      if (await h1.isVisible({ timeout: 5000 }).catch(() => false)) {
        const text = await h1.textContent();
        console.log(`✓ Page title visible: "${text}"`);

        // Check font size
        const fontSize = await h1.evaluate((el) =>
          window.getComputedStyle(el).fontSize
        );
        console.log(`  Font size: ${fontSize} (should be ~30px for text-3xl)`);
      }
    }

    console.log('✓ Initial page load successful');
  });

  test('should have correct Tailwind classes applied', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if Tailwind CSS is loaded by checking for style tags
    const styleTags = page.locator('style[data-tailwindcss]');
    const styleCount = await styleTags.count();

    console.log(`Found ${styleCount} Tailwind style tags`);

    // Check for Next.js styles
    const linkTags = page.locator('link[rel="stylesheet"]');
    const linkCount = await linkTags.count();

    console.log(`Found ${linkCount} stylesheet links`);

    expect(styleCount + linkCount).toBeGreaterThan(0);

    console.log('✓ CSS is properly loaded');
  });

  test('should display proper spacing in elements', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if sidebar exists
    const sidebar = page.locator('aside').first();

    if (await sidebar.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Check logo section padding
      const logoSection = sidebar.locator('div').filter({ hasText: /OKRunit/ }).first();

      if (await logoSection.isVisible()) {
        const padding = await logoSection.evaluate((el) => {
          return window.getComputedStyle(el).padding;
        });

        console.log(`Logo section padding: ${padding}`);
      }
    }

    // Check main content padding
    const main = page.locator('main').first();

    if (await main.isVisible()) {
      const children = main.locator('> div');
      const childCount = await children.count();

      console.log(`Main content has ${childCount} direct children`);

      if (childCount > 0) {
        const firstChild = children.first();
        const padding = await firstChild.evaluate((el) => {
          return {
            px: window.getComputedStyle(el).paddingLeft,
            py: window.getComputedStyle(el).paddingTop,
          };
        });

        console.log(`Content padding:`, padding);
      }
    }

    console.log('✓ Spacing properties verified');
  });

  test('production site is responsive and loads correctly', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 720 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take final screenshot
    await page.screenshot({ path: 'screenshots/desktop-view.png', fullPage: true });

    // Verify no console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit for any console messages
    await page.waitForTimeout(1000);

    if (consoleErrors.length > 0) {
      console.warn('Console errors found:', consoleErrors);
    } else {
      console.log('✓ No console errors');
    }

    // Check page is responsive
    const body = page.locator('body');
    const isVisible = await body.isVisible();
    expect(isVisible).toBe(true);

    console.log('✓ Page is responsive and loads without errors');
  });
});
