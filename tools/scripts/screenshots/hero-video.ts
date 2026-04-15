/**
 * Records a Zapier + OKrunit walkthrough video for the landing page hero.
 * Usage: npx tsx tools/scripts/screenshots/hero-video.ts
 *
 * Requires saved sessions:
 *   - .auth/zapier.json (Zapier login)
 *   - .auth/okrunit.json (OKrunit login)
 */

import { chromium, type Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const STATE_DIR = path.join(process.cwd(), "tools/scripts/screenshots/.auth");
const OUTPUT_DIR = path.join(process.cwd(), "public/videos");

async function slowType(page: Page, selector: string, text: string) {
  const el = page.locator(selector).first();
  await el.click();
  for (const char of text) {
    await el.press(char === " " ? "Space" : char);
    await page.waitForTimeout(80 + Math.random() * 60);
  }
}

async function main() {
  const zapierState = path.join(STATE_DIR, "zapier.json");
  const okrunitState = path.join(STATE_DIR, "okrunit.json");

  if (!fs.existsSync(zapierState)) {
    console.error("No Zapier session. Run: npx tsx browser.ts login zapier https://zapier.com/app/login");
    process.exit(1);
  }
  if (!fs.existsSync(okrunitState)) {
    console.error("No OKrunit session. Run: npx tsx browser.ts login okrunit http://localhost:3000/login");
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const videoPath = path.join(OUTPUT_DIR, "hero-walkthrough");
  if (!fs.existsSync(videoPath)) fs.mkdirSync(videoPath, { recursive: true });

  // Start with Zapier context (we'll switch to OKrunit context later)
  const browser = await chromium.launch({
    headless: true,
    args: ["--window-size=1440,900"],
  });

  console.log("Recording Zapier walkthrough...\n");

  // ===== PART 1: Zapier =====
  const zapierCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: zapierState,
    recordVideo: {
      dir: videoPath,
      size: { width: 1440, height: 900 },
    },
  });

  const zPage = await zapierCtx.newPage();

  // Step 1: Open existing zap with OKrunit configured
  console.log("1. Opening existing zap...");
  await zPage.goto("https://zapier.com/editor/357078467/published", { waitUntil: "networkidle" });
  await zPage.waitForTimeout(4000);

  // Step 2: Click on the OKrunit action step to open it
  console.log("2. Clicking OKrunit action step...");
  const okrunitStep = zPage.locator('text=OKrunit').first();
  if (await okrunitStep.isVisible({ timeout: 5000 }).catch(() => false)) {
    await okrunitStep.click();
    await zPage.waitForTimeout(3000);
  }

  // Step 3: Show the configured fields
  console.log("3. Showing fields configuration...");
  // Look for Configure/Action tab to show fields
  const configureTab = zPage.locator('text=Configure, button:has-text("Configure"), text=Action').first();
  if (await configureTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await configureTab.click();
    await zPage.waitForTimeout(2000);
  }

  // Scroll slowly through the fields for the video
  await zPage.waitForTimeout(3000);

  // Step 4: Show the test section
  console.log("4. Showing test section...");
  const testTab = zPage.locator('button:has-text("Test"), text=Test').first();
  if (await testTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await testTab.click();
    await zPage.waitForTimeout(3000);
  }

  // Pause to show the full zap
  await zPage.waitForTimeout(2000);

  // Close Zapier page to finalize its video
  await zPage.close();
  await zapierCtx.close();

  // ===== PART 2: OKrunit Dashboard =====
  console.log("\n8. Switching to OKrunit dashboard...");
  const okrCtx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: okrunitState,
    recordVideo: {
      dir: videoPath,
      size: { width: 1440, height: 900 },
    },
  });

  // Hide avatar
  await okrCtx.addInitScript(() => {
    const observer = new MutationObserver(() => {
      document.querySelectorAll('[data-slot="avatar"]').forEach((el) => ((el as HTMLElement).style.visibility = "hidden"));
    });
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
    });
  });

  const oPage = await okrCtx.newPage();

  await oPage.goto("http://localhost:3000/requests", { waitUntil: "networkidle" });
  await oPage.waitForTimeout(2000);

  // Anonymize
  await oPage.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent) {
        node.textContent = node.textContent
          .replace(/Nathaniel Stoddard's Organization/g, "My Organization")
          .replace(/Nathaniel Stoddard/g, "Alex Johnson")
          .replace(/Dev Org/g, "My Organization");
      }
    }
  });

  // Click on a request if one exists
  console.log("9. Opening a request...");
  const firstCard = oPage.locator("[data-tour='approval-card']").first();
  if (await firstCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await firstCard.click();
    await oPage.waitForTimeout(3000);
  } else {
    await oPage.waitForTimeout(3000);
  }

  await oPage.close();
  await okrCtx.close();
  await browser.close();

  // Find the recorded video files
  const videoFiles = fs.readdirSync(videoPath).filter(f => f.endsWith(".webm"));
  console.log(`\nRecorded ${videoFiles.length} video segments:`);
  videoFiles.forEach(f => {
    const size = fs.statSync(path.join(videoPath, f)).size;
    console.log(`  ${f} (${(size / 1024 / 1024).toFixed(1)}MB)`);
  });

  console.log(`\nVideos saved to ${videoPath}/`);
  console.log("Next: concatenate with ffmpeg and convert to mp4 for the landing page.");
}

main().catch(console.error);
