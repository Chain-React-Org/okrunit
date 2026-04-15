// Fix n8n step 1 screenshot - annotation box should be around the trigger node only
// Usage: npx tsx tools/scripts/screenshots/n8n-fix-step1.ts

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

async function clearAnn(page: Page) {
  await page.evaluate(() => document.querySelectorAll(".ann").forEach((e) => e.remove()));
}

async function main() {
  const statePath = path.join(STATE_DIR, "local.json");
  if (!fs.existsSync(statePath)) {
    console.error("No session.");
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

  await page.goto(`${N8N_BASE}/workflow/new`);
  await page.waitForTimeout(4000);

  // Add a Schedule Trigger
  const addBtn = page.locator('[data-test-id="canvas-plus-button"]').first();
  if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addBtn.click();
  }
  await page.waitForTimeout(2000);

  const searchInput = page.locator('input[placeholder="Search nodes..."]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill("Schedule");
    await page.waitForTimeout(2000);
  }

  const scheduleTrigger = page.locator('text=Schedule Trigger').first();
  const onSchedule = page.locator('text=On a Schedule').first();
  if (await scheduleTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
    await scheduleTrigger.click();
  } else if (await onSchedule.isVisible({ timeout: 3000 }).catch(() => false)) {
    await onSchedule.click();
  }
  await page.waitForTimeout(2000);

  // Close the node settings panel
  const closeBtn = page.locator('[data-test-id="ndv-close-button"], button[aria-label="Close"]').first();
  if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await closeBtn.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await page.waitForTimeout(1500);

  // Find the actual trigger node element on the canvas using its visual bounding box
  // The node is rendered as an SVG/div with the clock icon and "Schedule Trigger" text
  const nodeBox = await page.evaluate(() => {
    // Find the "Schedule Trigger" text on the canvas and get its parent node container
    const allText = document.querySelectorAll("*");
    for (const el of allText) {
      if (el.childElementCount === 0 && el.textContent?.trim() === "Schedule Trigger") {
        // Walk up to find the node container (a reasonably sized box)
        let node = el as HTMLElement;
        for (let i = 0; i < 15; i++) {
          if (!node.parentElement) break;
          node = node.parentElement;
          const r = node.getBoundingClientRect();
          // Look for the node box: roughly 80-200px wide and 60-150px tall
          if (r.width > 60 && r.width < 250 && r.height > 60 && r.height < 200) {
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          }
        }
      }
    }
    return null;
  });

  if (nodeBox) {
    console.log(`  Found node box: ${nodeBox.width}x${nodeBox.height} at (${nodeBox.x}, ${nodeBox.y})`);
    // Manually inject annotation with precise positioning
    await page.evaluate(({ x, y, w, h }) => {
      const pad = 8;
      const o = document.createElement("div");
      o.className = "ann";
      o.style.cssText = `position:fixed;left:${x - pad}px;top:${y - pad}px;width:${w + pad * 2}px;height:${h + pad * 2}px;border:3px solid #ef4444;border-radius:12px;pointer-events:none;z-index:99999;box-shadow:0 0 0 4px rgba(239,68,68,0.2);`;
      document.body.appendChild(o);
      const l = document.createElement("div");
      l.className = "ann";
      l.textContent = "1. Start with any trigger";
      l.style.cssText = `position:fixed;left:${x - pad}px;top:${y - pad - 32}px;background:#ef4444;color:#fff;font-size:14px;font-weight:600;font-family:-apple-system,sans-serif;padding:5px 14px;border-radius:8px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
      document.body.appendChild(l);
    }, { x: nodeBox.x, y: nodeBox.y, w: nodeBox.width, h: nodeBox.height });
  } else {
    console.log("  Could not find node box, trying fallback");
    // Fallback: just find any element with data-test-id containing "node"
    const fallback = await page.evaluate(() => {
      const nodes = document.querySelectorAll('[data-test-id*="canvas-node"]');
      for (const n of nodes) {
        const r = n.getBoundingClientRect();
        if (r.width > 50 && r.height > 50) {
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }
      }
      return null;
    });
    if (fallback) {
      await page.evaluate(({ x, y, w, h }) => {
        const pad = 8;
        const o = document.createElement("div");
        o.className = "ann";
        o.style.cssText = `position:fixed;left:${x - pad}px;top:${y - pad}px;width:${w + pad * 2}px;height:${h + pad * 2}px;border:3px solid #ef4444;border-radius:12px;pointer-events:none;z-index:99999;box-shadow:0 0 0 4px rgba(239,68,68,0.2);`;
        document.body.appendChild(o);
        const l = document.createElement("div");
        l.className = "ann";
        l.textContent = "1. Start with any trigger";
        l.style.cssText = `position:fixed;left:${x - pad}px;top:${y - pad - 32}px;background:#ef4444;color:#fff;font-size:14px;font-weight:600;font-family:-apple-system,sans-serif;padding:5px 14px;border-radius:8px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
        document.body.appendChild(l);
      }, { x: fallback.x, y: fallback.y, w: fallback.width, h: fallback.height });
    }
  }

  await snap(page, "n8n-step-1-trigger");
  await clearAnn(page);

  console.log("\nDone!");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
