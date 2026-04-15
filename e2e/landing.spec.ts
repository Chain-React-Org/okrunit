import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('displays title and hero text', async ({ page }) => {
    await page.goto('/');

    // Page should have OKRunit in the title
    await expect(page).toHaveTitle(/OKRunit/i);

    // Hero headline should be visible. The landing page has a prominent heading
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('hero section renders with CTA', async ({ page }) => {
    await page.goto('/');

    // Hero section should be visible
    const heroSection = page.locator('#hero');
    await expect(heroSection).toBeVisible();

    // Should have a heading in the hero
    const heading = heroSection.locator('h1').first();
    await expect(heading).toBeVisible();

    // Should have a CTA link (Start Free or Go to Dashboard)
    const cta = heroSection.locator('a').first();
    await expect(cta).toBeVisible();
  });

  test('navigation links work: Docs, Login, Sign up', async ({ page }) => {
    await page.goto('/');

    // Click "Log in" link
    const loginLink = page.locator('a[href="/login"]').first();
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL(/\/login/);

    // Go back and click "Sign up"
    await page.goto('/');
    const signupLink = page.locator('a[href="/signup"]').first();
    await expect(signupLink).toBeVisible();
    await signupLink.click();
    await expect(page).toHaveURL(/\/signup/);
  });

  test('mobile viewport shows hamburger menu', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    // The hamburger menu button should be visible on mobile (lg:hidden)
    const menuButton = page.locator('button:has-text("Open menu")').first();
    await expect(menuButton).toBeVisible();

    // Click to open mobile menu
    await menuButton.click();

    // Mobile menu should now show navigation items
    await expect(page.locator('[data-slot="sheet-content"] >> text=Docs').first()).toBeVisible();
    await expect(page.locator('[data-slot="sheet-content"] >> text=Integrations').first()).toBeVisible();
  });
});
