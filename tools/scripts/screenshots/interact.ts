// Interactive browser control for screenshot capture
// Usage: npx tsx tools/scripts/screenshots/interact.ts <platform> <command> [args...]
//
// Commands:
//   goto <url>                       Navigate to URL
//   click <selector>                 Click an element
//   fill <selector> <text>           Fill an input
//   type <selector> <text>           Type text into element (keystroke by keystroke)
//   wait <ms>                        Wait milliseconds
//   snap <filename>                  Take screenshot
//   circle <selector> [label]        Draw red circle annotation
//   circlexy <x> <y> [label]         Draw red circle at coordinates
//   box <selector> [label]           Draw red box annotation
//   clearann                         Clear all annotations
//   hover <selector>                 Hover over element
//   scroll <y>                       Scroll to y position
//   press <key>                      Press keyboard key (Enter, Tab, etc.)

import { chromium, type Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const STATE_DIR = path.join(process.cwd(), "tools/scripts/screenshots/.auth");
const OUTPUT_DIR = path.join(process.cwd(), "public/screenshots/docs/integrations");

const CIRCLE_COLOR = "#ef4444";

async function addCircle(page: Page, selector: string, label?: string) {
  await page.evaluate(({ selector, label, color }) => {
    const el = document.querySelector(selector);
    if (!el) { console.warn("Not found:", selector); return; }
    const rect = el.getBoundingClientRect();
    const pad = 12;
    const overlay = document.createElement("div");
    overlay.className = "okrunit-ann";
    const isSmall = Math.max(rect.width, rect.height) < 60;
    overlay.style.cssText = `position:fixed;left:${rect.left-pad}px;top:${rect.top-pad}px;width:${rect.width+pad*2}px;height:${rect.height+pad*2}px;border:3px solid ${color};border-radius:${isSmall?"50%":"12px"};pointer-events:none;z-index:99999;box-shadow:0 0 0 4px rgba(239,68,68,0.2);`;
    document.body.appendChild(overlay);
    if (label) {
      const c = document.createElement("div");
      c.className = "okrunit-ann";
      c.textContent = label;
      c.style.cssText = `position:fixed;left:${rect.right+pad+8}px;top:${rect.top+rect.height/2-14}px;background:${color};color:#fff;font-size:13px;font-weight:600;font-family:-apple-system,sans-serif;padding:4px 12px;border-radius:6px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
      document.body.appendChild(c);
    }
  }, { selector, label, color: CIRCLE_COLOR });
}

async function addCircleXY(page: Page, x: number, y: number, label?: string) {
  await page.evaluate(({ x, y, label, color }) => {
    const size = 48;
    const overlay = document.createElement("div");
    overlay.className = "okrunit-ann";
    overlay.style.cssText = `position:fixed;left:${x-size/2}px;top:${y-size/2}px;width:${size}px;height:${size}px;border:3px solid ${color};border-radius:50%;pointer-events:none;z-index:99999;box-shadow:0 0 0 4px rgba(239,68,68,0.2);`;
    document.body.appendChild(overlay);
    if (label) {
      const c = document.createElement("div");
      c.className = "okrunit-ann";
      c.textContent = label;
      c.style.cssText = `position:fixed;left:${x+size/2+8}px;top:${y-14}px;background:${color};color:#fff;font-size:13px;font-weight:600;font-family:-apple-system,sans-serif;padding:4px 12px;border-radius:6px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
      document.body.appendChild(c);
    }
  }, { x, y, label, color: CIRCLE_COLOR });
}

async function addBox(page: Page, selector: string, label?: string) {
  await page.evaluate(({ selector, label, color }) => {
    const el = document.querySelector(selector);
    if (!el) { console.warn("Not found:", selector); return; }
    const rect = el.getBoundingClientRect();
    const pad = 8;
    const overlay = document.createElement("div");
    overlay.className = "okrunit-ann";
    overlay.style.cssText = `position:fixed;left:${rect.left-pad}px;top:${rect.top-pad}px;width:${rect.width+pad*2}px;height:${rect.height+pad*2}px;border:3px solid ${color};border-radius:8px;background:rgba(239,68,68,0.08);pointer-events:none;z-index:99998;`;
    document.body.appendChild(overlay);
    if (label) {
      const c = document.createElement("div");
      c.className = "okrunit-ann";
      c.textContent = label;
      c.style.cssText = `position:fixed;left:${rect.left-pad}px;top:${rect.top-pad-28}px;background:${color};color:#fff;font-size:13px;font-weight:600;font-family:-apple-system,sans-serif;padding:4px 12px;border-radius:6px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
      document.body.appendChild(c);
    }
  }, { selector, label, color: CIRCLE_COLOR });
}

async function clearAnnotations(page: Page) {
  await page.evaluate(() => {
    document.querySelectorAll(".okrunit-ann").forEach(el => el.remove());
  });
}

async function main() {
  const [,, platform, command, ...args] = process.argv;

  if (!platform || !command) {
    console.log("Usage: npx tsx interact.ts <platform> <command> [args...]");
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const statePath = path.join(STATE_DIR, `${platform}.json`);
  if (!fs.existsSync(statePath)) {
    console.error(`No saved state for ${platform}. Run browser.ts login first.`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, args: ["--window-size=1440,900"] });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: statePath,
  });
  const page = await context.newPage();

  // Execute a sequence of commands separated by "|"
  // This lets us chain: goto|wait|circle|snap in one invocation
  const fullCommand = [command, ...args].join(" ");
  const steps = fullCommand.split("|").map(s => s.trim());

  for (const step of steps) {
    const parts = step.match(/(?:[^\s"]+|"[^"]*")+/g)?.map(s => s.replace(/^"|"$/g, "")) || [];
    const cmd = parts[0];

    switch (cmd) {
      case "goto":
        await page.goto(parts[1], { waitUntil: "networkidle", timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1000);
        break;
      case "click":
        await page.locator(parts[1]).first().click({ timeout: 10000 }).catch(e => console.error("Click failed:", e.message));
        await page.waitForTimeout(1000);
        break;
      case "fill":
        await page.locator(parts[1]).first().fill(parts.slice(2).join(" "), { timeout: 10000 }).catch(e => console.error("Fill failed:", e.message));
        await page.waitForTimeout(500);
        break;
      case "type":
        await page.locator(parts[1]).first().pressSequentially(parts.slice(2).join(" "), { delay: 50, timeout: 10000 }).catch(e => console.error("Type failed:", e.message));
        await page.waitForTimeout(500);
        break;
      case "wait":
        await page.waitForTimeout(parseInt(parts[1]) || 1000);
        break;
      case "snap": {
        const filePath = path.join(OUTPUT_DIR, `${parts[1]}.png`);
        await page.screenshot({ path: filePath, type: "png" });
        console.log(`✅ ${parts[1]}.png`);
        try {
          const sharp = require("sharp");
          const webpPath = path.join(OUTPUT_DIR, `${parts[1]}.webp`);
          await sharp(filePath).webp({ quality: 90 }).toFile(webpPath);
          fs.unlinkSync(filePath);
          console.log(`   → ${parts[1]}.webp`);
        } catch {}
        break;
      }
      case "circle":
        await addCircle(page, parts[1], parts[2]);
        break;
      case "circlexy":
        await addCircleXY(page, parseInt(parts[1]), parseInt(parts[2]), parts[3]);
        break;
      case "box":
        await addBox(page, parts[1], parts[2]);
        break;
      case "clearann":
        await clearAnnotations(page);
        break;
      case "hover":
        await page.locator(parts[1]).first().hover({ timeout: 10000 }).catch(e => console.error("Hover failed:", e.message));
        await page.waitForTimeout(500);
        break;
      case "scroll":
        await page.evaluate((y) => window.scrollTo(0, y), parseInt(parts[1]) || 0);
        await page.waitForTimeout(500);
        break;
      case "press":
        await page.keyboard.press(parts[1]);
        await page.waitForTimeout(500);
        break;
      case "pause":
        await page.pause();
        break;
      default:
        console.error(`Unknown command: ${cmd}`);
    }
  }

  // Save updated state (in case cookies changed)
  await context.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
