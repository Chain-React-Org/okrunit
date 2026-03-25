import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('displays title and hero text', async ({ page }) => {
    await page.goto('/');

    // Page should have OKRunit in the title
    await expect(page).toHaveTitle(/OKRunit/i);

    // Hero headline should be visible — the landing page has a prominent heading
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible();
  });

  test('pricing section renders 4 plans', async ({ page }) => {
    await page.goto('/');

    // Scroll to pricing section
    const pricingSection = page.locator('#pricing');
    await pricingSection.scrollIntoViewIfNeeded();
    await expect(pricingSection).toBeVisible();

    // Verify the "Simple, transparent pricing" heading
    await expect(pricingSection.locator('h2')).toContainText('pricing');

    // There should be 4 pricing tiers: Free, Pro, Business, Enterprise
    const tiers = pricingSection.locator('text=Free');
    await expect(tiers.first()).toBeVisible();
    await expect(pricingSection.locator('text=Pro').first()).toBeVisible();
    await expect(pricingSection.locator('text=Business').first()).toBeVisible();
    await expect(pricingSection.locator('text=Enterprise').first()).toBeVisible();
  });

  test('navigation links work — Docs, Login, Sign up', async ({ page }) => {
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

    // The desktop Log in / Sign up links should be hidden (they have md:inline-flex)
    // The hamburger menu button should be visible on mobile (md:hidden)
    const menuButton = page.locator('button.md\\:hidden, button:has(svg)').first();
    await expect(menuButton).toBeVisible();

    // Click to open mobile menu
    await menuButton.click();

    // Mobile menu should now show navigation items
    await expect(page.locator('text=Pricing').first()).toBeVisible();
    await expect(page.locator('text=Log in').first()).toBeVisible();
  });
});
