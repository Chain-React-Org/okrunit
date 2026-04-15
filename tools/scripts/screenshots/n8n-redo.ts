// Re-capture n8n screenshots with correct workflow flow
// Usage: npx tsx tools/scripts/screenshots/n8n-redo.ts

import { chromium, type Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const STATE_DIR = path.join(process.cwd(), "tools/scripts/screenshots/.auth");
const OUTPUT_DIR = path.join(process.cwd(), "public/screenshots/docs/integrations");
const N8N_BASE = "http://localhost:5678";

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

async function tryClick(page: Page, selectors: string[], timeout = 3000): Promise<boolean> {
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout }).catch(() => false)) {
      await el.click();
      return true;
    }
  }
  return false;
}

async function main() {
  const statePath = path.join(STATE_DIR, "local.json");
  if (!fs.existsSync(statePath)) {
    console.error("No session. Run n8n-capture.ts first.");
    process.exit(1);
  }

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

  // Start a fresh workflow
  await page.goto(`${N8N_BASE}/workflow/new`);
  await page.waitForTimeout(4000);

  // =============================================
  // STEP 1: Add a trigger first
  // =============================================
  console.log("=== Step 1: Add a trigger ===");
  await tryClick(page, ['[data-test-id="canvas-plus-button"]']);
  await page.waitForTimeout(2000);

  let searchInput = page.locator('input[placeholder="Search nodes..."]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill("Schedule");
    await page.waitForTimeout(2000);
  }
  // Click "On a Schedule" or "Schedule Trigger"
  await tryClick(page, ['text=On a Schedule', 'text=Schedule Trigger']);
  await page.waitForTimeout(2000);

  // Close the trigger settings panel
  // Click the X button on the panel, or press Escape, or click the canvas
  const closeBtn = page.locator('[data-test-id="ndv-close-button"], button[aria-label="Close"]').first();
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
  } else {
    // Click the X in the top right of the node detail view
    const xBtn = page.locator('.ndv-wrapper button.close, [class*="close"]').first();
    if (await xBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await xBtn.click();
    } else {
      await page.keyboard.press("Escape");
    }
  }
  await page.waitForTimeout(1000);

  // Take step 1 screenshot showing the canvas with trigger node
  // Annotate the trigger node
  const triggerNode = page.locator('[data-test-id="canvas-node"]:has-text("Schedule Trigger"), [class*="node"]:has-text("Schedule")').first();
  if (await triggerNode.isVisible({ timeout: 3000 }).catch(() => false)) {
    const tBox = await triggerNode.boundingBox();
    if (tBox) await annotate(page, tBox, "1. Start with any trigger", "top");
  }
  await snap(page, "n8n-step-1-trigger");
  await clearAnn(page);

  // =============================================
  // STEP 2: Open node picker again and search OKrunit
  // =============================================
  console.log("=== Step 2: Search for OKrunit ===");
  // Click the + between nodes or the canvas + button
  await tryClick(page, [
    '[data-test-id="canvas-plus-button"]',
    '[data-test-id="node-creator-plus-button"]',
  ]);
  await page.waitForTimeout(2000);

  searchInput = page.locator('input[placeholder="Search nodes..."]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill("OKrunit");
    await page.waitForTimeout(2000);

    const searchBox = await searchInput.boundingBox();
    if (searchBox) await annotate(page, searchBox, '2. Search for "OKrunit"');
    await snap(page, "n8n-step-2-search");
    await clearAnn(page);
    console.log("  Step 2 captured!");
  } else {
    console.log("  Could not find search input for step 2");
    await snap(page, "n8n-step-2-search");
  }

  // =============================================
  // STEP 3: Select OKrunit node from results
  // =============================================
  console.log("=== Step 3: Select OKrunit ===");
  const okrunit = page.locator("text=OKrunit").first();
  if (await okrunit.isVisible({ timeout: 3000 }).catch(() => false)) {
    const box = await okrunit.boundingBox();
    if (box) await annotate(page, box, "3. Select OKrunit");
    await snap(page, "n8n-step-3-select");
    await clearAnn(page);
    await okrunit.click();
    await page.waitForTimeout(2000);
    console.log("  Step 3 captured!");
  } else {
    console.log("  OKrunit not visible");
    await snap(page, "n8n-step-3-select");
  }

  // =============================================
  // STEP 4: Select "Create an approval request"
  // =============================================
  console.log("=== Step 4: Select action ===");
  const createApproval = page.locator("text=Create an approval request").first();
  if (await createApproval.isVisible({ timeout: 3000 }).catch(() => false)) {
    const caBox = await createApproval.boundingBox();
    if (caBox) await annotate(page, caBox, "4. Create an approval request");
    await snap(page, "n8n-step-4-action");
    await clearAnn(page);
    await createApproval.click();
    await page.waitForTimeout(2000);
    console.log("  Step 4 captured!");
  } else {
    console.log("  'Create an approval request' not visible");
    await snap(page, "n8n-step-4-action");
  }

  // =============================================
  // STEP 5: Node config panel with all fields annotated
  // =============================================
  console.log("=== Step 5: Configure fields ===");

  // Find and annotate each field by searching for labels
  const fieldAnnotations: Array<{ text: string; label: string }> = [
    { text: "Credential", label: "Your API key" },
    { text: "Template Name or ID", label: "Select a template (optional)" },
    { text: "Title", label: "Required" },
    { text: "Description", label: "Required" },
    { text: "Priority", label: "Optional" },
    { text: "Wait for Decision", label: "Auto-waits for decision" },
  ];

  for (const { text, label } of fieldAnnotations) {
    const row = await page.evaluate((searchText) => {
      // Find the label element
      const allElements = document.querySelectorAll("label, span, div");
      for (const el of allElements) {
        if (el.textContent?.trim() === searchText && el.childElementCount === 0) {
          // Get the parent container that includes the label + input
          let node = el as HTMLElement;
          for (let i = 0; i < 5; i++) {
            if (!node.parentElement) break;
            node = node.parentElement;
            const r = node.getBoundingClientRect();
            // Look for a row-sized container
            if (r.width > 150 && r.height > 25 && r.height < 80) {
              return { x: r.x, y: r.y, width: r.width, height: r.height };
            }
          }
          // Fallback: just use the label element itself
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
      }
      return null;
    }, text);

    if (row) {
      await annotate(page, row, label, "right");
    }
  }

  await snap(page, "n8n-step-5-fields");
  await clearAnn(page);
  console.log("  Step 5 captured!");

  console.log("\nAll n8n screenshots captured!");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
