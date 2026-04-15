/**
 * Captures real app screenshots for the landing page.
 * Usage: npx tsx tools/scripts/screenshots/landing-captures.ts
 *
 * Requires a saved session at .auth/okrunit.json
 * (run: npx tsx tools/scripts/screenshots/browser.ts login okrunit http://localhost:3000/login)
 */

import { chromium, type Page } from "playwright";
import * as path from "path";
import * as fs from "fs";
import sharp from "sharp";

const STATE_PATH = path.join(__dirname, ".auth/okrunit.json");
const OUTPUT_DIR = path.join(process.cwd(), "public/screenshots/landing");
const BASE_URL = "http://localhost:3000";

async function cleanup(page: Page) {
  // Hide Next.js dev overlay
  await page.evaluate(() => {
    document
      .querySelectorAll(
        "nextjs-portal, [data-nextjs-dialog-overlay], [data-nextjs-toast]"
      )
      .forEach((el) => el.remove());
    const style = document.createElement("style");
    style.textContent = `
      nextjs-portal, [data-nextjs-toast], [data-nextjs-dialog-overlay] { display: none !important; }
      body > div[style*="position: fixed"][style*="bottom"] { display: none !important; }
      body > aside { display: none !important; }
      #__next-build-indicator { display: none !important; }
    `;
    document.head.appendChild(style);
    document.querySelectorAll("body > *").forEach((el) => {
      const cs = window.getComputedStyle(el);
      if (cs.position === "fixed") {
        (el as HTMLElement).style.display = "none";
      }
    });
    document
      .querySelectorAll("body > :not(#__next):not(div[id])")
      .forEach((el) => {
        if (
          el.tagName !== "SCRIPT" &&
          el.tagName !== "STYLE" &&
          el.tagName !== "LINK"
        ) {
          const cs = window.getComputedStyle(el);
          if (cs.position === "fixed" || el.shadowRoot) {
            (el as HTMLElement).style.display = "none";
          }
        }
      });
  });

  // Anonymize personal info
  await page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent) {
        node.textContent = node.textContent
          .replace(/Nathaniel Stoddard's Organization/g, "Acme Corp")
          .replace(/Nathaniel Stoddard/g, "Alex Johnson")
          .replace(/Test Admin/g, "Jamie Lee")
          .replace(/test@okrunit\.com/g, "jamie@acme.com")
          .replace(/stoddard\.nathaniel@yahoo\.com/g, "alex@acme.com");
      }
    }
  });

  // Hide user avatar button in header
  await page.evaluate(() => {
    // Hide avatar trigger buttons
    document
      .querySelectorAll('button:has([data-slot="avatar"])')
      .forEach((el) => {
        (el as HTMLElement).style.visibility = "hidden";
      });
  });
}

async function shot(page: Page, name: string) {
  await cleanup(page);
  await page.waitForTimeout(200);

  const pngPath = path.join(OUTPUT_DIR, `${name}.png`);
  const webpPath = path.join(OUTPUT_DIR, `${name}.webp`);

  await page.screenshot({ path: pngPath, fullPage: false });

  // Convert to webp
  await sharp(pngPath).webp({ quality: 90 }).toFile(webpPath);
  fs.unlinkSync(pngPath);

  console.log(`  ${name}.webp`);
}

async function main() {
  if (!fs.existsSync(STATE_PATH)) {
    console.error(
      "No saved session. Run: npx tsx tools/scripts/screenshots/browser.ts login okrunit http://localhost:3000/login"
    );
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: STATE_PATH,
  });

  // Inject style to hide avatars globally
  await context.addInitScript(() => {
    const observer = new MutationObserver(() => {
      document
        .querySelectorAll('[data-slot="avatar"]')
        .forEach((el) => ((el as HTMLElement).style.visibility = "hidden"));
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        observer.observe(document.body, { childList: true, subtree: true });
      });
    }
  });

  const page = await context.newPage();

  console.log("Capturing landing page screenshots...\n");

  // 1. Hero: Org overview
  console.log("1/5 Org overview (hero)");
  await page.goto(`${BASE_URL}/org/overview`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, "hero-overview");

  // 2. Approval Flow: Requests page with detail panel open
  console.log("2/5 Approval flow (request detail)");
  await page.goto(`${BASE_URL}/requests`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  // Click the first request card to open the detail panel
  const firstCard = page.locator("[data-tour='approval-card']").first();
  if (await firstCard.isVisible()) {
    await firstCard.click();
    await page.waitForTimeout(800);
  }
  await shot(page, "hero-approval-flow");

  // 3. Queue: Requests page (just the queue, no detail open)
  console.log("3/5 Queue view");
  // Close the detail panel if open by pressing Escape
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
  await shot(page, "hero-queue");

  // 4. Routing: Routes page
  console.log("4/5 Routes & messaging");
  await page.goto(`${BASE_URL}/requests/routes`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await shot(page, "hero-routes");

  // 5. Audit: Audit log page
  console.log("5/5 Audit trail");
  await page.goto(`${BASE_URL}/requests/audit-log`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(1500);
  await shot(page, "hero-audit");

  await browser.close();
  console.log("\nDone! Screenshots saved to public/screenshots/landing/");
}

main().catch(console.error);
