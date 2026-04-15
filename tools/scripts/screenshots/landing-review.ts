/**
 * Scrolls through the landing page and captures at intervals to review each section.
 * Usage: npx tsx tools/scripts/screenshots/landing-review.ts
 */

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";
import sharp from "sharp";

const OUTPUT_DIR = path.join(process.cwd(), "public/screenshots/landing");
const BASE_URL = "http://localhost:3000";

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);

  // Get total page height
  const totalHeight = await page.evaluate(() => document.body.scrollHeight);
  console.log(`Page height: ${totalHeight}px`);

  // Scroll through the page capturing every ~1.5 viewports
  const step = 800;
  let idx = 0;
  for (let scrollY = 0; scrollY < totalHeight; scrollY += step) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(800);

    const pngPath = path.join(OUTPUT_DIR, `review-${idx}.png`);
    const webpPath = path.join(OUTPUT_DIR, `review-${idx}.webp`);
    await page.screenshot({ path: pngPath, fullPage: false });
    await sharp(pngPath).webp({ quality: 90 }).toFile(webpPath);
    fs.unlinkSync(pngPath);
    console.log(`  Captured at scroll ${scrollY}px -> review-${idx}.webp`);
    idx++;
  }

  await browser.close();
  console.log(`\nDone! ${idx} screenshots in public/screenshots/landing/`);
}

main().catch(console.error);
