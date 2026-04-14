// n8n screenshot capture - step by step with pause
// Opens browser, navigates n8n, pauses at each step for you to interact if needed.
// Usage: npx tsx tools/scripts/screenshots/n8n-capture.ts
//
// The script will:
// 1. Open n8n and pause at the login page (sign in, then click Resume in Playwright Inspector)
// 2. Navigate through the workflow editor capturing screenshots at each step

import { chromium, type Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const STATE_DIR = path.join(process.cwd(), "tools/scripts/screenshots/.auth");
const OUTPUT_DIR = path.join(process.cwd(), "public/screenshots/docs/integrations");
const N8N_BASE = "http://localhost:5678";

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

const sharp = require("sharp");

async function snap(page: Page, name: string) {
  const png = path.join(OUTPUT_DIR, `${name}.png`);
  const webp = path.join(OUTPUT_DIR, `${name}.webp`);
  await page.screenshot({ path: png, type: "png" });
  await sharp(png).webp({ quality: 90 }).toFile(webp);
  fs.unlinkSync(png);
  console.log(`  Saved: ${name}.webp`);
}

async function annotate(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
  label: string,
  side: "right" | "left" | "top" | "bottom" = "right",
) {
  const { x, y, width: w, height: h } = box;
  await page.evaluate(
    ({ x, y, w, h, label, side }) => {
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
    },
    { x, y, w, h, label, side },
  );
}

async function clearAnn(page: Page) {
  await page.evaluate(() => document.querySelectorAll(".ann").forEach((e) => e.remove()));
}

async function main() {
  const statePath = path.join(STATE_DIR, "local.json");

  console.log("Launching browser...");
  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=1440,900"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();

  // Step 0: Login
  console.log("\n=== STEP 0: Sign in ===");
  console.log("Sign in to n8n, then click RESUME in the Playwright Inspector.");
  await page.goto(`${N8N_BASE}/signin`);
  await page.pause(); // <-- User signs in, clicks Resume

  // Save session
  await ctx.storageState({ path: statePath });
  console.log("Session saved.\n");

  // Step 1: New workflow + open node picker + search
  console.log("=== STEP 1: Node picker search ===");
  await page.goto(`${N8N_BASE}/workflow/new`);
  await page.waitForTimeout(4000);

  // Dump all visible buttons/inputs for debugging
  const elements = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll("button, input, [role='button']").forEach((el) => {
      const text = (el as HTMLElement).innerText?.trim().substring(0, 60);
      const ph = (el as HTMLInputElement).placeholder || "";
      const testId = el.getAttribute("data-test-id") || "";
      if (text || ph || testId) {
        results.push(`${el.tagName} | text="${text}" | ph="${ph}" | data-test-id="${testId}"`);
      }
    });
    return results;
  });
  console.log("Visible interactive elements:");
  elements.forEach((e) => console.log(`  ${e}`));

  // Try to open node picker
  // In n8n, clicking the big + on the canvas or pressing Tab opens the node picker
  const addBtn = page.locator('[data-test-id="canvas-plus-button"]').first();
  if (await addBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log("  Found canvas-plus-button, clicking...");
    await addBtn.click();
  } else {
    // Try the "Click the + button" or other prompt
    console.log("  canvas-plus-button not found, trying Tab key...");
    await page.keyboard.press("Tab");
  }
  await page.waitForTimeout(2000);

  // Find and use search
  const allInputs = await page.locator("input").all();
  console.log(`  Found ${allInputs.length} input elements after opening picker`);
  for (const inp of allInputs) {
    const visible = await inp.isVisible().catch(() => false);
    const ph = await inp.getAttribute("placeholder").catch(() => "");
    console.log(`    input visible=${visible} placeholder="${ph}"`);
  }

  // Use the first visible input
  let searchInput = null;
  for (const inp of allInputs) {
    if (await inp.isVisible().catch(() => false)) {
      searchInput = inp;
      break;
    }
  }

  if (searchInput) {
    await searchInput.fill("OKrunit");
    await page.waitForTimeout(2000);

    const searchBox = await searchInput.boundingBox();
    if (searchBox) await annotate(page, searchBox, '1. Search for "OKrunit"');
    await snap(page, "n8n-step-1-search");
    await clearAnn(page);
    console.log("  Step 1 captured!");
  } else {
    console.log("  No visible input found. Pausing for manual interaction...");
    console.log("  Please open the node picker manually, then click Resume.");
    await page.pause();
    // After resume, try again
    const retryInputs = await page.locator("input:visible").all();
    if (retryInputs.length > 0) {
      searchInput = retryInputs[0];
      await searchInput.fill("OKrunit");
      await page.waitForTimeout(2000);
      const searchBox = await searchInput.boundingBox();
      if (searchBox) await annotate(page, searchBox, '1. Search for "OKrunit"');
      await snap(page, "n8n-step-1-search");
      await clearAnn(page);
    }
  }

  // Step 2: Select OKrunit from results
  console.log("\n=== STEP 2: Select OKrunit ===");
  const okrunit = page.locator("text=OKrunit").first();
  if (await okrunit.isVisible({ timeout: 3000 }).catch(() => false)) {
    const box = await okrunit.boundingBox();
    if (box) await annotate(page, box, "2. Select OKrunit");
    await snap(page, "n8n-step-2-select-node");
    await clearAnn(page);
    await okrunit.click();
    await page.waitForTimeout(3000);
    console.log("  Step 2 captured!");
  } else {
    console.log("  OKrunit not visible. Pausing...");
    await page.pause();
    await snap(page, "n8n-step-2-select-node");
  }

  // Step 3: Action selection (if applicable)
  console.log("\n=== STEP 3: Action selection ===");
  const actions = ["Create Approval", "Request Approval", "Create an Approval Request"];
  let foundAction = false;
  for (const actionText of actions) {
    const el = page.locator(`text=${actionText}`).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      const box = await el.boundingBox();
      if (box) await annotate(page, box, "3. Choose Create Approval");
      await snap(page, "n8n-step-3-select-action");
      await clearAnn(page);
      await el.click();
      await page.waitForTimeout(2000);
      foundAction = true;
      console.log("  Step 3 captured!");
      break;
    }
  }
  if (!foundAction) {
    console.log("  No action picker shown (node may have opened directly)");
  }

  // Step 4: Node configuration panel (credentials + fields)
  console.log("\n=== STEP 4: Credentials ===");
  // Look for credential-related UI
  const credEl = page.locator("text=Credential to connect with, text=Credential for").first();
  if (await credEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    const box = await credEl.boundingBox();
    if (box) await annotate(page, box, "4. Add your API key", "right");
  }
  await snap(page, "n8n-step-4-credentials");
  await clearAnn(page);
  console.log("  Step 4 captured!");

  // Step 5: Fields
  console.log("\n=== STEP 5: Fields ===");
  // Scroll the node panel down to show more fields
  await page.evaluate(() => {
    const panels = document.querySelectorAll('[class*="ndv"], [class*="node-settings"], [role="dialog"]');
    panels.forEach((p) => { (p as HTMLElement).scrollTop += 300; });
  });
  await page.waitForTimeout(500);
  await snap(page, "n8n-step-5-fields");
  console.log("  Step 5 captured!");

  // Done
  console.log("\n=== All n8n screenshots captured! ===");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
