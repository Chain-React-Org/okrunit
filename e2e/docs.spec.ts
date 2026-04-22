import { test, expect } from '@playwright/test';

test.describe('Docs pages', () => {
  test('getting started page has expected content', async ({ page }) => {
    await page.goto('/docs');

    await expect(page.locator('h1')).toContainText('Getting Started');

    // Should describe what OKRunit is
    await expect(page.locator('text=human-in-the-loop').first()).toBeVisible();

    // Should have "How it works" section
    await expect(page.locator('text=How it works').first()).toBeVisible();

    // Should have "Quick start" section
    await expect(page.locator('text=Quick start').first()).toBeVisible();
  });

  test('API reference page has expected content', async ({ page }) => {
    await page.goto('/docs/api');

    await expect(page.locator('h1')).toContainText('API Reference');

    // Should document endpoints
    await expect(page.locator('text=Authorization').first()).toBeVisible();
  });

  test('integrations page lists 19 integrations', async ({ page }) => {
    await page.goto('/docs/integrations');

    await expect(page.locator('h1')).toContainText('Integrations');

    // The page says "18 platforms"
    await expect(page.locator('text=18 platforms').first()).toBeVisible();

    // Verify key integration categories are listed
    await expect(page.locator('text=Automation Platforms').first()).toBeVisible();
    await expect(page.locator('text=AI Agents').first()).toBeVisible();
    await expect(page.locator('text=Workflow Engines').first()).toBeVisible();

    // Verify specific integrations appear
    await expect(page.locator('text=Zapier').first()).toBeVisible();
    await expect(page.locator('text=GitHub Actions').first()).toBeVisible();
    await expect(page.locator('text=Temporal').first()).toBeVisible();
    await expect(page.locator('text=LangChain').first()).toBeVisible();
  });

  test('sidebar navigation links navigate between docs pages', async ({ page }) => {
    await page.goto('/docs');

    // Click "API Reference" in sidebar (desktop sidebar is visible at lg breakpoint)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/docs');

    const sidebar = page.locator('aside nav');
    await expect(sidebar).toBeVisible();

    // Navigate to API Reference. Next.js Link triggers a client-side
    // transition, so give the new route's content time to render before
    // asserting the heading.
    await sidebar.locator('a', { hasText: 'API Reference' }).click();
    await expect(page).toHaveURL(/\/docs\/api/);
    await expect(page.locator('main h1')).toContainText('API Reference', { timeout: 10_000 });

    // Navigate to Integrations
    await page.locator('aside nav').locator('a', { hasText: 'Integrations' }).click();
    await expect(page).toHaveURL(/\/docs\/integrations/);
    await expect(page.locator('main h1')).toContainText('Integrations', { timeout: 10_000 });

    // Navigate back to Overview (Getting Started)
    await page.locator('aside nav').locator('a', { hasText: 'Overview' }).click();
    await expect(page).toHaveURL(/\/docs$/);
    await expect(page.locator('main h1')).toContainText('Getting Started', { timeout: 10_000 });
  });

  test('docs layout has proper sidebar navigation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/docs');

    // Sidebar should contain all expected nav items
    const sidebar = page.locator('aside nav');
    await expect(sidebar).toBeVisible();

    await expect(sidebar.locator('a', { hasText: 'Overview' })).toBeVisible();
    await expect(sidebar.locator('a', { hasText: 'API Reference' })).toBeVisible();
    await expect(sidebar.locator('a', { hasText: 'Integrations' })).toBeVisible();
    await expect(sidebar.locator('a', { hasText: 'Webhooks & Callbacks' })).toBeVisible();
    await expect(sidebar.locator('a', { hasText: 'Plans & Billing' })).toBeVisible();
  });
});
