// Zapier screenshot capture. Opens browser, pauses for login, then controlled step by step
// Usage: npx tsx tools/scripts/screenshots/zapier-capture.ts
// After login, the script saves browser state and exits.
// Subsequent steps use the saved state.

import { chromium } from "playwright";
import * as path from "path";
import * as fs from "fs";

const STATE_DIR = path.join(process.cwd(), "tools/scripts/screenshots/.auth");
const OUTPUT_DIR = path.join(process.cwd(), "public/screenshots/docs/integrations");

async function main() {
  const step = process.argv[2] || "login";

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true });

  if (step === "login") {
    // Step 1: Open browser for login, save session
    const browser = await chromium.launch({ headless: false, args: ["--window-size=1440,900"] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto("https://zapier.com/app/login");

    // Pause. User signs in, then clicks Resume in Inspector
    await page.pause();

    // Save signed-in state
    await context.storageState({ path: path.join(STATE_DIR, "zapier.json") });
    console.log("✅ Login state saved. You can now run individual steps.");
    await browser.close();
    return;
  }

  // For all other steps, load saved session
  const statePath = path.join(STATE_DIR, "zapier.json");
  if (!fs.existsSync(statePath)) {
    console.error("No saved login state. Run with 'login' first.");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, args: ["--window-size=1440,900"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: statePath,
  });
  const page = await context.newPage();

  // Navigate based on step
  switch (step) {
    case "editor": {
      await page.goto("https://zapier.com/editor");
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(3000);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "zapier-step-1-editor.png"), type: "png" });
      console.log("✅ zapier-step-1-editor.png");
      // Pause so we can see what happened and decide next action
      await page.pause();
      break;
    }
    default: {
      // Generic: just open a URL and pause
      await page.goto(step);
      await page.waitForLoadState("networkidle");
      await page.pause();
      break;
    }
  }

  await browser.close();
}

main().catch(console.error);
