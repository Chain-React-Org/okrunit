import { test, expect } from '@playwright/test';

test.describe('Auth pages', () => {
  test('login page renders the login form', async ({ page }) => {
    await page.goto('/login');

    // Should show heading
    await expect(page.locator('h1')).toContainText('Welcome back');

    // Should have email and password inputs
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Should have a submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign in');
  });

  test('signup page renders the signup form', async ({ page }) => {
    await page.goto('/signup');

    // Should have email and password fields
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();

    // Should have a submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('empty login form shows validation error', async ({ page }) => {
    await page.goto('/login');

    // Click submit without filling anything — browser validation will prevent submission
    // Since inputs have `required`, we check that the form does not navigate away
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();

    // Email input should show browser validation (required field)
    const emailInput = page.locator('input[type="email"]');
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    );
    expect(isInvalid).toBe(true);

    // Should still be on login page
    await expect(page).toHaveURL(/\/login/);
  });

  test('invalid credentials show error message', async ({ page }) => {
    await page.goto('/login');

    // Fill with invalid credentials
    await page.fill('input[type="email"]', 'nonexistent@example.com');
    await page.fill('input[type="password"]', 'wrongpassword123');

    // Submit the form
    await page.locator('button[type="submit"]').click();

    // Wait for the error message to appear (from Supabase auth failure)
    const errorMessage = page.locator('[class*="destructive"], [role="alert"]');
    await expect(errorMessage.first()).toBeVisible({ timeout: 10_000 });
  });

  test('forgot password page renders', async ({ page }) => {
    await page.goto('/forgot-password');

    // Should not 404 — the page exists
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('docs page loads without auth', async ({ page }) => {
    await page.goto('/docs');

    // Should load the Getting Started page without redirect to login
    await expect(page).toHaveURL(/\/docs/);
    await expect(page.locator('h1')).toContainText('Getting Started');
  });
});
