// Re-annotate n8n step 4 and step 5 screenshots with proper red overlays
// Usage: npx tsx tools/scripts/screenshots/n8n-annotate.ts

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

  // Navigate to new workflow
  await page.goto(`${N8N_BASE}/workflow/new`);
  await page.waitForTimeout(4000);

  // Open node picker and add OKrunit
  const addBtn = page.locator('[data-test-id="canvas-plus-button"]').first();
  if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addBtn.click();
  }
  await page.waitForTimeout(2000);

  // Search for OKrunit
  const searchInput = page.locator('input[placeholder="Search nodes..."]').first();
  if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput.fill("OKrunit");
    await page.waitForTimeout(2000);
  }

  // Click OKrunit
  const okrunit = page.locator("text=OKrunit").first();
  if (await okrunit.isVisible({ timeout: 3000 }).catch(() => false)) {
    await okrunit.click();
    await page.waitForTimeout(2000);
  }

  // Click "Create an approval request"
  const createApproval = page.locator("text=Create an approval request").first();
  if (await createApproval.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createApproval.click();
    await page.waitForTimeout(2000);
  }

  // Now we should be on the node config panel
  // Step 4: Annotate the Credential field
  console.log("=== Step 4: Credential annotation ===");
  const credLabel = page.locator("text=Credential").first();
  const credDropdown = page.locator('div:has(> label:text-is("Credential")) select, div:has(> span:text-is("Credential")) ~ div').first();

  // Find the credential row - look for the dropdown near "Credential"
  const credRow = await page.evaluate(() => {
    const labels = document.querySelectorAll("label, span");
    for (const label of labels) {
      if (label.textContent?.trim() === "Credential") {
        // Get the parent row
        const parent = label.closest("div");
        if (parent) {
          const rect = parent.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
      }
    }
    return null;
  });

  if (credRow) {
    await annotate(page, credRow, "4. Connect your API key", "right");
  }
  await snap(page, "n8n-step-4-credentials");
  await clearAnn(page);

  // Step 5: Annotate the fields (Title, Description, Priority)
  console.log("=== Step 5: Fields annotation ===");

  // Find Title field area
  const titleRow = await page.evaluate(() => {
    const labels = document.querySelectorAll("label, span");
    for (const label of labels) {
      if (label.textContent?.trim() === "Title") {
        const parent = label.closest("div");
        if (parent) {
          // Get a larger area including the input
          const nextInput = parent.querySelector("input, textarea");
          if (nextInput) {
            const lr = label.getBoundingClientRect();
            const ir = nextInput.getBoundingClientRect();
            return {
              x: Math.min(lr.x, ir.x),
              y: lr.y,
              width: Math.max(lr.right, ir.right) - Math.min(lr.x, ir.x),
              height: ir.bottom - lr.y,
            };
          }
          const rect = parent.getBoundingClientRect();
          return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
        }
      }
    }
    return null;
  });

  // Find a group covering Title through Priority
  const fieldsArea = await page.evaluate(() => {
    const labels = document.querySelectorAll("label, span");
    let titleTop = Infinity;
    let priorityBottom = 0;
    let leftMost = Infinity;
    let rightMost = 0;
    for (const label of labels) {
      const text = label.textContent?.trim();
      if (text === "Title" || text === "Description" || text === "Priority") {
        const parent = label.closest("div");
        if (parent) {
          const rect = parent.getBoundingClientRect();
          titleTop = Math.min(titleTop, rect.top);
          priorityBottom = Math.max(priorityBottom, rect.bottom);
          leftMost = Math.min(leftMost, rect.left);
          rightMost = Math.max(rightMost, rect.right);
        }
      }
    }
    if (titleTop < Infinity && priorityBottom > 0) {
      return { x: leftMost, y: titleTop, width: rightMost - leftMost, height: priorityBottom - titleTop };
    }
    return null;
  });

  if (fieldsArea) {
    await annotate(page, fieldsArea, "5. Configure request fields", "left");
  }
  await snap(page, "n8n-step-5-fields");
  await clearAnn(page);

  console.log("\nDone! Annotated screenshots saved.");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
