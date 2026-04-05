// Capture all monday.com integration screenshots in one run
// Usage: npx tsx tools/scripts/screenshots/monday-all.ts
//
// Prerequisites:
//   npx tsx tools/scripts/screenshots/browser.ts login monday "https://auth.monday.com/login"

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
  console.log(`✅ ${name}.webp`);
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
  const statePath = path.join(STATE_DIR, "monday.json");
  if (!fs.existsSync(statePath)) {
    console.error(
      'No monday.com login state. Run:\n  npx tsx tools/scripts/screenshots/browser.ts login monday "https://auth.monday.com/login"',
    );
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

  // ---- Step 1: Board view — highlight the Integrate button ----
  console.log("\n📸 Step 1: Board view — Integrate button...");
  // Navigate to the main board (user's first board)
  await page.goto("https://monday.com", { waitUntil: "networkidle" });
  await page.waitForTimeout(4000);

  // Click into first available board if we're on the home/dashboard
  const boardLink = page
    .locator(
      'a[href*="/boards/"], [data-testid="board-link"], .board-link, a:has-text("Board")',
    )
    .first();
  if (
    await boardLink
      .isVisible({ timeout: 5000 })
      .catch(() => false)
  ) {
    await boardLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);
  }

  // Find and highlight the Integrate button
  const integrateBtn = page
    .locator(
      'button:has-text("Integrate"), [data-testid="board-header-integration"], button:has-text("Automate"), [aria-label*="ntegrat"]',
    )
    .first();
  if (
    await integrateBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false)
  ) {
    const ibBox = await integrateBtn.boundingBox();
    if (ibBox) await annotate(page, ibBox, '1. Click "Integrate"');
  } else {
    console.log(
      "  ⚠️  Integrate button not found. Taking screenshot of current state.",
    );
    console.log(
      "  TIP: Make sure you're on a board page. You may need to pause and navigate manually.",
    );
  }
  await snap(page, "monday-step-1-board");
  await clearAnn(page);

  // ---- Step 2: Integration center — search for OKrunit ----
  console.log("\n📸 Step 2: Integration center — search...");
  if (
    await integrateBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false)
  ) {
    await integrateBtn.click();
    await page.waitForTimeout(3000);
  }

  const searchInput = page
    .locator(
      'input[placeholder*="Search"], input[placeholder*="search"], input[type="search"], input[data-testid="search-input"]',
    )
    .first();
  if (
    await searchInput
      .isVisible({ timeout: 5000 })
      .catch(() => false)
  ) {
    const siBox = await searchInput.boundingBox();
    if (siBox) await annotate(page, siBox, '2. Search for "OKrunit"');
  }
  await snap(page, "monday-step-2-integration-center");
  await clearAnn(page);

  // ---- Step 3: Search results — select OKrunit ----
  console.log("\n📸 Step 3: Search results...");
  if (
    await searchInput
      .isVisible({ timeout: 3000 })
      .catch(() => false)
  ) {
    await searchInput.fill("OKrunit");
    await page.waitForTimeout(2000);
  }

  const okrunitResult = page.locator("text=OKrunit").first();
  if (
    await okrunitResult
      .isVisible({ timeout: 5000 })
      .catch(() => false)
  ) {
    const orBox = await okrunitResult.boundingBox();
    if (orBox) await annotate(page, orBox, "3. Select OKrunit");
  } else {
    console.log(
      "  ⚠️  OKrunit not found in search results (app may not be published yet).",
    );
    console.log(
      "  Taking screenshot of current state. Re-run after the app is live in the marketplace.",
    );
  }
  await snap(page, "monday-step-3-search-okrunit");
  await clearAnn(page);

  // ---- Step 4: Recipe selection — choose a recipe ----
  console.log("\n📸 Step 4: Recipe selection...");
  if (
    await okrunitResult
      .isVisible({ timeout: 3000 })
      .catch(() => false)
  ) {
    await okrunitResult.click();
    await page.waitForTimeout(3000);
  }

  // Look for recipe cards or "Use recipe" buttons
  const recipeBtn = page
    .locator(
      'button:has-text("Use"), button:has-text("Add to board"), button:has-text("Add"), text=When status changes',
    )
    .first();
  if (
    await recipeBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false)
  ) {
    const rbBox = await recipeBtn.boundingBox();
    if (rbBox) await annotate(page, rbBox, "4. Choose a recipe");
  }
  await snap(page, "monday-step-4-recipe");
  await clearAnn(page);

  // ---- Step 5: OAuth authorization ----
  console.log("\n📸 Step 5: Authorization...");
  // If clicking the recipe triggers an auth flow, capture it
  if (
    await recipeBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false)
  ) {
    await recipeBtn.click();
    await page.waitForTimeout(3000);
  }

  // Look for authorization/connect prompt
  const authBtn = page
    .locator(
      'button:has-text("Connect"), button:has-text("Authorize"), button:has-text("Sign in"), text=Connect your account',
    )
    .first();
  if (
    await authBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false)
  ) {
    const abBox = await authBtn.boundingBox();
    if (abBox) await annotate(page, abBox, "5. Authorize OKrunit");
  }
  await snap(page, "monday-step-5-authorize");
  await clearAnn(page);

  console.log("\n🎉 monday.com screenshots complete!");
  console.log("Output: public/screenshots/docs/integrations/monday-step-*.webp");
  console.log(
    "\nNote: If the OKrunit app is not yet published to the monday.com Marketplace,",
  );
  console.log(
    "some screenshots may show empty search results. Re-run after publishing.",
  );

  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
