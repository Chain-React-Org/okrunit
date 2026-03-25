import { test, expect } from '@playwright/test';

test.describe('Billing page (smoke test)', () => {
  test('visiting /billing without auth redirects to login', async ({ page }) => {
    await page.goto('/billing');

    // Since /billing is inside the (dashboard) group, it requires authentication.
    // The middleware should redirect unauthenticated users to /login.
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
