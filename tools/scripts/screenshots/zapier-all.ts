// Capture all Zapier integration screenshots in one run
// Usage: npx tsx tools/scripts/screenshots/zapier-all.ts

import { chromium, type Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const STATE_DIR = path.join(process.cwd(), "tools/scripts/screenshots/.auth");
const OUTPUT_DIR = path.join(process.cwd(), "public/screenshots/docs/integrations");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sharp = require("sharp");

async function snap(page: Page, name: string) {
  const png = path.join(OUTPUT_DIR, `${name}.png`);
  const webp = path.join(OUTPUT_DIR, `${name}.webp`);
  await page.screenshot({ path: png, type: "png" });
  await sharp(png).webp({ quality: 90 }).toFile(webp);
  fs.unlinkSync(png);
  console.log(`✅ ${name}.webp`);
}

async function annotate(page: Page, box: { x: number; y: number; width: number; height: number }, label: string, side: "right" | "left" | "top" | "bottom" = "right") {
  const { x, y, width: w, height: h } = box;
  await page.evaluate(({ x, y, w, h, label, side }) => {
    const pad = 6;
    const o = document.createElement("div");
    o.className = "ann";
    o.style.cssText = `position:fixed;left:${x - pad}px;top:${y - pad}px;width:${w + pad * 2}px;height:${h + pad * 2}px;border:3px solid #ef4444;border-radius:12px;pointer-events:none;z-index:99999;box-shadow:0 0 0 4px rgba(239,68,68,0.2);`;
    document.body.appendChild(o);
    const l = document.createElement("div");
    l.className = "ann";
    l.textContent = label;
    let pos = "";
    if (side === "right") pos = `left:${x + w + pad + 10}px;top:${y + h / 2 - 14}px;`;
    else if (side === "left") pos = `right:${window.innerWidth - x + pad + 10}px;top:${y + h / 2 - 14}px;`;
    else if (side === "top") pos = `left:${x - pad}px;top:${y - pad - 32}px;`;
    else if (side === "bottom") pos = `left:${x - pad}px;top:${y + h + pad + 6}px;`;
    l.style.cssText = `position:fixed;${pos}background:#ef4444;color:#fff;font-size:14px;font-weight:600;font-family:-apple-system,sans-serif;padding:5px 14px;border-radius:8px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
    document.body.appendChild(l);
  }, { x, y, w, h, label, side });
}

async function clearAnn(page: Page) {
  await page.evaluate(() => document.querySelectorAll(".ann").forEach(e => e.remove()));
}

async function parentBox(page: Page, textSelector: string, minW = 200, minH = 50, maxH = 200) {
  const loc = page.locator(textSelector).first();
  return await loc.evaluate((el, { minW, minH, maxH }) => {
    let node = el as HTMLElement;
    for (let i = 0; i < 10; i++) {
      if (!node.parentElement) break;
      node = node.parentElement;
      const r = node.getBoundingClientRect();
      if (r.width > minW && r.height > minH && r.height < maxH) {
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    }
    return null;
  }, { minW, minH, maxH });
}

async function main() {
  const statePath = path.join(STATE_DIR, "zapier.json");
  if (!fs.existsSync(statePath)) {
    console.error("No Zapier login state. Run: npx tsx browser.ts login zapier https://zapier.com/app/login");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, args: ["--window-size=1440,900"] });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: statePath,
  });
  const page = await ctx.newPage();

  // ---- Step 1: Zap editor - highlight the Action card ----
  console.log("\n📸 Step 1: Zap editor - click Action...");
  await page.goto("https://zapier.com/editor");
  await page.waitForTimeout(4000);
  const actionBox = await parentBox(page, "text=Select the event for your Zap to run");
  if (actionBox) await annotate(page, actionBox, "1. Click Action");
  await snap(page, "zapier-step-1-editor");
  await clearAnn(page);

  // ---- Step 2: Click Action to open app picker, highlight search ----
  console.log("\n📸 Step 2: App picker - search bar...");
  await page.locator("text=Select the event for your Zap to run").first().click();
  await page.waitForTimeout(2000);
  const searchInput = page.locator('input[placeholder*="Search"]').first();
  const searchBox = await searchInput.boundingBox();
  if (searchBox) await annotate(page, searchBox, "2. Search for OKrunit");
  await snap(page, "zapier-step-2-app-picker");
  await clearAnn(page);

  // ---- Step 3: Type OKrunit, show result ----
  console.log("\n📸 Step 3: Search results...");
  await searchInput.fill("OKrunit");
  await page.waitForTimeout(2000);
  const okrunitResult = page.locator('text=OKrunit').first();
  const okrunitBox = await okrunitResult.boundingBox();
  if (okrunitBox) await annotate(page, okrunitBox, "3. Select OKrunit");
  await snap(page, "zapier-step-3-search-okrunit");
  await clearAnn(page);

  // ---- Step 4: Click OKrunit, show event/action selection ----
  console.log("\n📸 Step 4: Select action event...");
  await okrunitResult.click();
  await page.waitForTimeout(3000);

  // Look for the "Action event" or event dropdown in the right panel
  const eventDropdown = page.locator('select, [role="combobox"], button:has-text("Choose an event"), button:has-text("Choose an action")').first();
  if (await eventDropdown.isVisible({ timeout: 5000 }).catch(() => false)) {
    const edBox = await eventDropdown.boundingBox();
    if (edBox) await annotate(page, edBox, "4. Choose action event");
    await snap(page, "zapier-step-4-event-dropdown");
    await clearAnn(page);

    // Try clicking to open dropdown
    await eventDropdown.click();
    await page.waitForTimeout(1500);
  }

  // Look for "Request Approval" in dropdown or list
  const reqApproval = page.locator('text=Request Approval').first();
  if (await reqApproval.isVisible({ timeout: 5000 }).catch(() => false)) {
    const raBox = await reqApproval.boundingBox();
    if (raBox) await annotate(page, raBox, "Select Request Approval");
    await snap(page, "zapier-step-4b-request-approval");
    await clearAnn(page);
    await reqApproval.click();
    await page.waitForTimeout(2000);
  } else {
    console.log("  ⚠️  Request Approval not visible in dropdown");
    await snap(page, "zapier-step-4-current-state");
  }

  // ---- Step 5: Account / Auth section ----
  console.log("\n📸 Step 5: Account connection...");
  // Look for account/auth UI
  const selectAccount = page.locator('button:has-text("Select"), button:has-text("Sign in"), button:has-text("Connect"), text=Select an account').first();
  if (await selectAccount.isVisible({ timeout: 5000 }).catch(() => false)) {
    const saBox = await selectAccount.boundingBox();
    if (saBox) await annotate(page, saBox, "5. Connect your OKrunit account");
  }
  // Also annotate the Account section header if visible
  const accountLabel = page.locator('text=Account').first();
  if (await accountLabel.isVisible({ timeout: 2000 }).catch(() => false)) {
    // Find the whole account section
    const accountSection = await accountLabel.evaluate((el) => {
      let node = el as HTMLElement;
      for (let i = 0; i < 5; i++) {
        if (!node.parentElement) break;
        node = node.parentElement;
        const r = node.getBoundingClientRect();
        if (r.height > 40 && r.height < 120 && r.width > 200) {
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }
      }
      return null;
    });
    if (accountSection) await annotate(page, accountSection, "5. Connect your account", "top");
  }
  await snap(page, "zapier-step-5-account");
  await clearAnn(page);

  // ---- Step 6: Fields / Configure section ----
  console.log("\n📸 Step 6: Configure fields...");
  // Look for the "Continue" button to advance past account, or look for field inputs
  const continueBtn = page.locator('button:has-text("Continue")').first();
  if (await continueBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await continueBtn.click();
    await page.waitForTimeout(2000);
  }

  // Take screenshot of whatever field configuration is showing
  await snap(page, "zapier-step-6-fields");

  // ---- Step 7: Test ----
  console.log("\n📸 Step 7: Test step...");
  // Look for test button
  const testBtn = page.locator('button:has-text("Test"), button:has-text("Test step"), button:has-text("Test action"), button:has-text("Test trigger")').first();
  if (await testBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const tbBox = await testBtn.boundingBox();
    if (tbBox) await annotate(page, tbBox, "6. Test the step");
    await snap(page, "zapier-step-7-test");
    await clearAnn(page);
  } else {
    console.log("  ⚠️  Test button not found");
  }

  console.log("\n🎉 Zapier screenshots complete!");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
