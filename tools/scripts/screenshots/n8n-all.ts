// Capture all n8n integration screenshots in one run
// Usage: npx tsx tools/scripts/screenshots/n8n-all.ts
//
// Prerequisites:
//   1. n8n must be running locally (http://localhost:5678)
//   2. Save login session:
//      npx tsx tools/scripts/screenshots/browser.ts login local "http://localhost:5678/signin"
//   3. The OKrunit community node must be installed
//      (Settings > Community nodes > Install > n8n-nodes-okrunit)

import { chromium, type Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const STATE_DIR = path.join(process.cwd(), "tools/scripts/screenshots/.auth");
const OUTPUT_DIR = path.join(
  process.cwd(),
  "public/screenshots/docs/integrations",
);

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sharp = require("sharp");

async function snap(page: Page, name: string) {
  const png = path.join(OUTPUT_DIR, `${name}.png`);
  const webp = path.join(OUTPUT_DIR, `${name}.webp`);
  await page.screenshot({ path: png, type: "png" });
  await sharp(png).webp({ quality: 90 }).toFile(webp);
  fs.unlinkSync(png);
  console.log(`  ${name}.webp`);
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
      if (side === "right")
        pos = `left:${x + w + pad + 10}px;top:${y + h / 2 - 14}px;`;
      else if (side === "left")
        pos = `right:${window.innerWidth - x + pad + 10}px;top:${y + h / 2 - 14}px;`;
      else if (side === "top")
        pos = `left:${x - pad}px;top:${y - pad - 32}px;`;
      else if (side === "bottom")
        pos = `left:${x - pad}px;top:${y + h + pad + 6}px;`;
      l.style.cssText = `position:fixed;${pos}background:#ef4444;color:#fff;font-size:14px;font-weight:600;font-family:-apple-system,sans-serif;padding:5px 14px;border-radius:8px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
      document.body.appendChild(l);
    },
    { x, y, w, h, label, side },
  );
}

async function clearAnn(page: Page) {
  await page.evaluate(() =>
    document.querySelectorAll(".ann").forEach((e) => e.remove()),
  );
}

async function main() {
  // Try local.json first (for localhost n8n), then n8n.json (for n8n cloud)
  let statePath = path.join(STATE_DIR, "local.json");
  if (!fs.existsSync(statePath)) {
    statePath = path.join(STATE_DIR, "n8n.json");
  }
  if (!fs.existsSync(statePath)) {
    console.error(
      'No n8n login state found. Run:\n  npx tsx tools/scripts/screenshots/browser.ts login local "http://localhost:5678/signin"',
    );
    process.exit(1);
  }
  console.log(`Using session: ${statePath}`);

  const N8N_BASE = "http://localhost:5678";

  const browser = await chromium.launch({
    headless: false,
    args: ["--window-size=1440,900"],
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: statePath,
  });
  const page = await ctx.newPage();

  // ---- Step 1: Create new workflow, open node picker, search OKrunit ----
  console.log("\nStep 1: Open node picker and search...");
  await page.goto(`${N8N_BASE}/workflow/new`);
  await page.waitForTimeout(4000);

  // Click the + button or "Click the + button" prompt to open node picker
  // n8n has various ways to add nodes - try the canvas add button
  const addNodeBtn = page.locator('[data-test-id="canvas-plus-button"]').first();
  const addFirstStep = page.locator('button:has-text("Add first step")').first();

  if (await addNodeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addNodeBtn.click();
  } else if (await addFirstStep.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addFirstStep.click();
  } else {
    // Try clicking the big + in the center of canvas
    const plusBtn = page.locator('[class*="plus"], [class*="add-node"], button[aria-label*="Add"]').first();
    if (await plusBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await plusBtn.click();
    }
  }
  await page.waitForTimeout(2000);

  // Find the search input in the node creator panel
  const nodeSearch = page.locator('[data-test-id="node-creator-search-bar"] input, [placeholder*="Search"], [placeholder*="search"]').first();

  if (await nodeSearch.isVisible({ timeout: 5000 }).catch(() => false)) {
    await nodeSearch.fill("OKrunit");
    await page.waitForTimeout(2000);

    const searchBox = await nodeSearch.boundingBox();
    if (searchBox) await annotate(page, searchBox, '1. Search for "OKrunit"');
    await snap(page, "n8n-step-1-search");
    await clearAnn(page);
  } else {
    console.log("  Search input not found, taking current state");
    await snap(page, "n8n-step-1-search");
  }

  // ---- Step 2: Show OKrunit in results and select it ----
  console.log("\nStep 2: Select OKrunit node...");
  const okrunitResult = page.locator('[data-test-id="item-iterator-item"]:has-text("OKrunit"), [class*="node-item"]:has-text("OKrunit"), text=OKrunit').first();

  if (await okrunitResult.isVisible({ timeout: 5000 }).catch(() => false)) {
    const resultBox = await okrunitResult.boundingBox();
    if (resultBox) await annotate(page, resultBox, "2. Select OKrunit");
    await snap(page, "n8n-step-2-select-node");
    await clearAnn(page);

    await okrunitResult.click();
    await page.waitForTimeout(2000);
  } else {
    console.log("  OKrunit not found in results, trying text match");
    // Try broader text match
    const okText = page.locator('span:has-text("OKrunit"), div:has-text("OKrunit")').first();
    if (await okText.isVisible({ timeout: 3000 }).catch(() => false)) {
      const textBox = await okText.boundingBox();
      if (textBox) await annotate(page, textBox, "2. Select OKrunit");
      await snap(page, "n8n-step-2-select-node");
      await clearAnn(page);
      await okText.click();
      await page.waitForTimeout(2000);
    } else {
      await snap(page, "n8n-step-2-select-node");
    }
  }

  // ---- Step 3: Select the action (Create Approval) ----
  console.log("\nStep 3: Select action...");
  // n8n may show a list of operations or go directly to config
  const createApproval = page.locator('text=Create Approval, text=Request Approval, text=Create an Approval Request').first();
  if (await createApproval.isVisible({ timeout: 3000 }).catch(() => false)) {
    const caBox = await createApproval.boundingBox();
    if (caBox) await annotate(page, caBox, "3. Choose Create Approval");
    await snap(page, "n8n-step-3-select-action");
    await clearAnn(page);
    await createApproval.click();
    await page.waitForTimeout(2000);
  } else {
    console.log("  Action picker not shown (may have opened directly to config)");
  }

  // ---- Step 4: Credential / API key section ----
  console.log("\nStep 4: Credentials...");
  // n8n shows credential selector at the top of the node settings panel
  // Look for credential-related elements
  const credSelect = page.locator('[data-test-id="node-credentials-select"], [class*="credential"], button:has-text("Create New Credential"), button:has-text("Create new")').first();

  if (await credSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
    const credBox = await credSelect.boundingBox();
    if (credBox) await annotate(page, credBox, "4. Add your API key");
    await snap(page, "n8n-step-4-credentials");
    await clearAnn(page);
  } else {
    // Try finding any credential-related text
    const credLabel = page.locator('label:has-text("Credential"), text=Credential for OKrunit').first();
    if (await credLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      const clBox = await credLabel.boundingBox();
      if (clBox) await annotate(page, clBox, "4. Add your API key", "right");
    }
    await snap(page, "n8n-step-4-credentials");
    await clearAnn(page);
  }

  // ---- Step 5: Configure fields (title, details, etc.) ----
  console.log("\nStep 5: Configure fields...");
  // Scroll down in the node settings to show the fields
  const nodePanel = page.locator('[data-test-id="node-settings"], [class*="node-settings"], [class*="ndv-"]').first();
  if (await nodePanel.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Try scrolling the panel to show fields
    await nodePanel.evaluate((el) => el.scrollTop = 200);
    await page.waitForTimeout(500);
  }

  // Look for input fields like title, details
  const titleParam = page.locator('[data-test-id*="title"], [data-test-id*="parameter-input"], input[placeholder*="title"], input[placeholder*="Title"]').first();
  if (await titleParam.isVisible({ timeout: 3000 }).catch(() => false)) {
    const tfBox = await titleParam.boundingBox();
    if (tfBox) await annotate(page, tfBox, "5. Configure request fields", "right");
  }
  await snap(page, "n8n-step-5-fields");
  await clearAnn(page);

  // ---- Step 6: Show callback URL field ----
  console.log("\nStep 6: Callback URL field...");
  const callbackParam = page.locator('text=Callback URL, [data-test-id*="callback"], input[placeholder*="callback"]').first();
  if (await callbackParam.isVisible({ timeout: 3000 }).catch(() => false)) {
    const cbBox = await callbackParam.boundingBox();
    if (cbBox) await annotate(page, cbBox, "6. Paste Wait node resume URL here", "bottom");
    await snap(page, "n8n-step-6-callback");
    await clearAnn(page);
  } else {
    console.log("  Callback URL field not visible");
  }

  console.log("\nn8n screenshots complete!");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
