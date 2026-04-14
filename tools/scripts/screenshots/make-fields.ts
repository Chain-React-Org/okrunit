// Capture Make fields step showing the Template field
// Pauses for manual interaction, then captures.
// Usage: npx tsx tools/scripts/screenshots/make-fields.ts

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

async function main() {
  const statePath = path.join(STATE_DIR, "make.json");
  if (!fs.existsSync(statePath)) {
    console.error("No Make session.");
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

  // Go to Make scenarios
  console.log("Opening Make...");
  await page.goto("https://www.make.com/en");
  await page.waitForTimeout(3000);

  console.log("\n=== MANUAL STEP ===");
  console.log("1. Create a new scenario (or open an existing one)");
  console.log("2. Add the OKrunit 'Request an Approval' module");
  console.log("3. Connect your OKrunit account");
  console.log("4. When you see the FIELDS (Template, What needs approval, Details, Callback URL, etc.) -> click RESUME\n");
  await page.pause();

  // Capture the fields view
  console.log("Capturing Make fields screenshot...");
  await snap(page, "make-step-6-fields-v3");

  console.log("\nMake capture complete!");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
