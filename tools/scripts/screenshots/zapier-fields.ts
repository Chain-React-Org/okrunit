// Capture Zapier fields step showing the Template field
// Pauses for manual interaction, then captures.
// Usage: npx tsx tools/scripts/screenshots/zapier-fields.ts

import { chromium, type Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const STATE_DIR = path.join(process.cwd(), "tools/scripts/screenshots/.auth");
const OUTPUT_DIR = path.join(process.cwd(), "public/screenshots/docs/integrations");

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
  const statePath = path.join(STATE_DIR, "zapier.json");
  if (!fs.existsSync(statePath)) {
    console.error("No Zapier session.");
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

  // Go to Zapier editor
  console.log("Opening Zapier editor...");
  await page.goto("https://zapier.com/editor");
  await page.waitForTimeout(4000);

  console.log("\n=== MANUAL STEP ===");
  console.log("1. Click the Action step");
  console.log("2. Search for OKrunit and select it");
  console.log("3. Select 'Request Approval'");
  console.log("4. Connect your OKrunit account");
  console.log("5. Click Continue to reach the FIELDS view");
  console.log("6. When you see Template, Title, Details fields -> click RESUME\n");
  await page.pause();

  // Now capture the fields view
  console.log("Capturing fields screenshot...");
  await snap(page, "zapier-step-6-fields-v2");

  // Take test screenshot too
  console.log("\nNow navigate to the Test tab, then click RESUME.");
  await page.pause();

  const testBtn = page.locator('button:has-text("Test"), button:has-text("Test step")').first();
  if (await testBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const tbBox = await testBtn.boundingBox();
    if (tbBox) await annotate(page, tbBox, "7. Test the step");
    await snap(page, "zapier-step-7-test-v3");
    await clearAnn(page);
  } else {
    await snap(page, "zapier-step-7-test-v3");
  }

  console.log("\nZapier capture complete!");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
