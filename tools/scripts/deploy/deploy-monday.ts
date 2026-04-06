#!/usr/bin/env npx tsx

/**
 * deploy-monday.ts
 *
 * Deploys the OKRunit monday.com app.
 *
 * Opens the monday.com apps developer platform in a visible browser, waits for
 * the user to sign in, then guides them through configuring the app with the
 * correct OAuth 2.0 settings and integration recipes.
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  INTEGRATIONS_DIR,
  log,
  logStep,
  logWaiting,
  logSuccess,
  logError,
  launchBrowser,
  waitForUserLogin,
  takeScreenshot,
  safeClick,
  safeWaitForSelector,
  readJsonFile,
  readFile,
  runDeployment,
} from './helpers.js';

const PLATFORM = 'monday.com';
const MONDAY_DIR = path.join(INTEGRATIONS_DIR, 'monday');
const MONDAY_DEV_URL = 'https://monday.com/developers/apps';
const TOTAL_STEPS = 6;

async function main(): Promise<void> {
  const { browser, page } = await launchBrowser();

  try {
    // Step 1: Login
    logStep(PLATFORM, 1, TOTAL_STEPS, 'Opening monday.com developer platform...');
    await waitForUserLogin(
      page,
      PLATFORM,
      MONDAY_DEV_URL,
      /monday\.com\/(developers|apps)/,
      300_000
    );

    // Step 2: Find or create the OKRunit app
    logStep(PLATFORM, 2, TOTAL_STEPS, 'Looking for OKRunit app...');

    await page.goto('https://monday.com/developers/apps', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    const appLink = page.locator('a:has-text("OKRunit"), [data-name="OKRunit"]').first();
    const appExists = await appLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (appExists) {
      log(PLATFORM, 'Found existing OKRunit app. Opening...');
      await appLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      log(PLATFORM, 'OKRunit app not found. Creating a new app...');

      const createBtn = page.locator(
        'button:has-text("Create"), a:has-text("Create app"), button:has-text("New app"), button:has-text("Build app")'
      ).first();

      if (await createBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await createBtn.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1_000);

        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i], input[id*="name" i]').first();
        if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await nameInput.fill('OKRunit');
        }

        const descInput = page.locator('textarea, input[name="description"]').first();
        if (await descInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await descInput.fill(
            'Human-in-the-loop approval gateway for AI agents and automated workflows.'
          );
        }

        const submitBtn = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
        if (await submitBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await submitBtn.click();
          await page.waitForLoadState('networkidle');
        }
      } else {
        logWaiting(PLATFORM,
          'Could not find the "Create" button. Please create the app manually named "OKRunit".\n' +
          'Press Enter in the terminal when the app is created and you are on its page.'
        );
        await page.pause();
      }
    }

    await takeScreenshot(page, 'monday', 'app-page');

    // Step 3: Configure OAuth 2.0
    logStep(PLATFORM, 3, TOTAL_STEPS, 'Configuring OAuth 2.0...');

    const oauthConfig = readJsonFile(path.join(MONDAY_DIR, 'connections', 'oauth2.json')) as Record<string, unknown>;
    log(PLATFORM, 'Read OAuth 2.0 configuration.');

    // Navigate to OAuth section
    const oauthTab = page.locator(
      'a:has-text("OAuth"), [data-tab="oauth"], button:has-text("OAuth"), a:has-text("Credentials")'
    ).first();

    if (await oauthTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await oauthTab.click();
      await page.waitForLoadState('networkidle');
    }

    logWaiting(PLATFORM,
      'Please configure OAuth 2.0 with these settings:\n\n' +
      '  Redirect URL:     https://okrunit.com/api/v1/oauth/callback\n' +
      '  Scopes:           approvals:read, approvals:write, comments:write\n' +
      '  Token URL:        https://okrunit.com/api/v1/oauth/token\n' +
      '  Authorize URL:    https://okrunit.com/oauth/authorize\n\n' +
      'Copy the Client ID and Client Secret — you\'ll need them for your .env file.\n' +
      'Press Enter when done.'
    );
    await page.pause();

    await takeScreenshot(page, 'monday', 'oauth');

    // Step 4: Configure app features (integration recipes)
    logStep(PLATFORM, 4, TOTAL_STEPS, 'Configuring integration features...');

    const featuresTab = page.locator(
      'a:has-text("Features"), [data-tab="features"], button:has-text("Features"), a:has-text("Build")'
    ).first();

    if (await featuresTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await featuresTab.click();
      await page.waitForLoadState('networkidle');
    }

    const modulesDir = path.join(MONDAY_DIR, 'modules');
    const moduleFiles = fs.readdirSync(modulesDir).filter(f => f.endsWith('.json'));

    logWaiting(PLATFORM,
      'Please add an "Integration" feature to the app, then configure these recipes:\n\n' +
      '  TRIGGERS:\n' +
      '    1. New Approval Request — polls GET /api/v1/approvals for new items\n' +
      '    2. Approval Decided    — polls GET /api/v1/approvals for decided items\n' +
      '    3. Approval Decision Received — instant webhook trigger\n\n' +
      '  ACTIONS:\n' +
      '    4. Request Approval    — POST /api/v1/approvals (creates approval)\n' +
      '    5. Add Comment         — POST /api/v1/approvals/{id}/comments\n\n' +
      '  SEARCHES:\n' +
      '    6. Get Approval        — GET /api/v1/approvals/{id}\n' +
      '    7. List Approvals      — GET /api/v1/approvals with filters\n\n' +
      `  Module definitions are at: ${modulesDir}\n` +
      '  Each JSON file describes the parameters, URL, method, and sample output.\n\n' +
      'Press Enter when done.'
    );
    await page.pause();

    await takeScreenshot(page, 'monday', 'features');

    // Step 5: Configure app settings
    logStep(PLATFORM, 5, TOTAL_STEPS, 'Configuring app settings...');

    const baseConfig = readJsonFile(path.join(MONDAY_DIR, 'base.json')) as Record<string, unknown>;

    logWaiting(PLATFORM,
      'Please verify app settings:\n\n' +
      `  App Name:    ${baseConfig.label}\n` +
      `  Description: ${baseConfig.description}\n` +
      `  Base URL:    ${baseConfig.baseUrl}\n` +
      `  Version:     ${baseConfig.version}\n\n` +
      'Also set:\n' +
      '  - App icon: Use the monday.png logo from public/logos/platforms/monday.png\n' +
      '  - Category: Productivity / Project Management\n' +
      '  - Permissions: Read/write boards, items (for future board integrations)\n\n' +
      'Press Enter when done.'
    );
    await page.pause();

    await takeScreenshot(page, 'monday', 'settings');

    // Step 6: Review and prepare for publishing
    logStep(PLATFORM, 6, TOTAL_STEPS, 'Review and prepare for publishing...');

    logWaiting(PLATFORM,
      'Final review before publishing:\n\n' +
      '  1. Test the OAuth flow by clicking "Test" in the OAuth section\n' +
      '  2. Verify all integration recipes are configured correctly\n' +
      '  3. Add screenshots and marketing copy for the Marketplace listing\n' +
      '  4. Submit for review when ready\n\n' +
      'To test locally:\n' +
      '  1. Add MONDAY_CLIENT_ID and MONDAY_CLIENT_SECRET to your .env.local\n' +
      '  2. Set the redirect URL to http://localhost:3000/api/v1/oauth/callback\n' +
      '  3. Install the app to a test monday.com account\n\n' +
      'Press Enter to finish.'
    );
    await page.pause();

    await takeScreenshot(page, 'monday', 'final');
    logSuccess(PLATFORM, 'monday.com app configuration complete.');
  } catch (err) {
    await takeScreenshot(page, 'monday', 'error');
    throw err;
  } finally {
    await browser.close();
  }
}

runDeployment(PLATFORM, main);
