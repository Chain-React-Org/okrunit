// Re-capture n8n step 5 with Make.com-style arrow annotations
// Just opens OKrunit node directly (no trigger needed for this screenshot)
// Usage: npx tsx tools/scripts/screenshots/n8n-fix-step5.ts

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

  // New workflow, add OKrunit directly
  await page.goto(`${N8N_BASE}/workflow/new`);
  await page.waitForTimeout(4000);

  // Open node picker
  const addBtn = page.locator('[data-test-id="canvas-plus-button"]').first();
  if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) await addBtn.click();
  await page.waitForTimeout(2000);

  // Search OKrunit
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

  // Click Create an approval request
  const createApproval = page.locator("text=Create an approval request").first();
  if (await createApproval.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createApproval.click();
    await page.waitForTimeout(2000);
  }

  // Verify we're on the config panel
  const panelTitle = page.locator("text=Create an approval request").first();
  const isOnPanel = await panelTitle.isVisible({ timeout: 3000 }).catch(() => false);
  console.log(`On config panel: ${isOnPanel}`);

  // Debug: what's visible
  const titleVisible = await page.locator("text=Title").first().isVisible({ timeout: 2000 }).catch(() => false);
  const descVisible = await page.locator("text=Description").first().isVisible({ timeout: 2000 }).catch(() => false);
  console.log(`Title visible: ${titleVisible}, Description visible: ${descVisible}`);

  if (!titleVisible) {
    console.log("Config fields not visible, taking debug screenshot");
    await snap(page, "n8n-step-5-debug");
    await browser.close();
    return;
  }

  // Inject Make-style annotations: red boxes on fields + one label + dashed arrows
  await page.evaluate(() => {
    const fieldLabels = ["Title", "Description", "Priority", "Template Name or ID"];

    const fieldRects: { x: number; y: number; w: number; h: number }[] = [];
    for (const labelText of fieldLabels) {
      const allElements = document.querySelectorAll("label, span, div");
      for (const el of allElements) {
        if (el.childElementCount === 0 && el.textContent?.trim() === labelText) {
          let node = el as HTMLElement;
          for (let i = 0; i < 5; i++) {
            if (!node.parentElement) break;
            node = node.parentElement;
            const r = node.getBoundingClientRect();
            if (r.width > 150 && r.height > 25 && r.height < 80) {
              fieldRects.push({ x: r.x, y: r.y, w: r.width, h: r.height });
              break;
            }
          }
          break;
        }
      }
    }

    if (fieldRects.length === 0) return;

    // Draw red border boxes around each field
    for (const { x, y, w, h } of fieldRects) {
      const pad = 4;
      const o = document.createElement("div");
      o.className = "ann";
      o.style.cssText = `position:fixed;left:${x - pad}px;top:${y - pad}px;width:${w + pad * 2}px;height:${h + pad * 2}px;border:3px solid #ef4444;border-radius:8px;pointer-events:none;z-index:99999;box-shadow:0 0 0 3px rgba(239,68,68,0.15);`;
      document.body.appendChild(o);
    }

    // Calculate label position - centered vertically among all fields, to the left
    const topY = fieldRects[0].y;
    const bottomY = fieldRects[fieldRects.length - 1].y + fieldRects[fieldRects.length - 1].h;
    const midY = (topY + bottomY) / 2;
    const leftX = Math.min(...fieldRects.map((r) => r.x));

    // Main label pill
    const labelX = leftX - 210;
    const label = document.createElement("div");
    label.className = "ann";
    label.textContent = "5. Configure these fields";
    label.style.cssText = `position:fixed;left:${labelX}px;top:${midY - 14}px;background:#ef4444;color:#fff;font-size:14px;font-weight:600;font-family:-apple-system,sans-serif;padding:5px 14px;border-radius:8px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
    document.body.appendChild(label);

    // Draw dashed arrow lines from label to each field
    const labelRightX = labelX + 195;

    for (const { x, y, h } of fieldRects) {
      const fieldLeftX = x - 4;
      const fieldMidY = y + h / 2;

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("class", "ann");
      const svgLeft = Math.min(labelRightX, fieldLeftX);
      const svgTop = Math.min(midY, fieldMidY) - 5;
      const svgW = Math.abs(fieldLeftX - labelRightX) + 10;
      const svgH = Math.abs(fieldMidY - midY) + 10;

      svg.style.cssText = `position:fixed;left:${svgLeft}px;top:${svgTop}px;width:${svgW}px;height:${svgH}px;pointer-events:none;z-index:99998;overflow:visible;`;

      const startX = labelRightX - svgLeft;
      const startY = midY - svgTop;
      const endX = fieldLeftX - svgLeft;
      const endY = fieldMidY - svgTop;

      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(startX));
      line.setAttribute("y1", String(startY));
      line.setAttribute("x2", String(endX));
      line.setAttribute("y2", String(endY));
      line.setAttribute("stroke", "#ef4444");
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-dasharray", "6,3");
      svg.appendChild(line);

      // Arrowhead
      const angle = Math.atan2(endY - startY, endX - startX);
      const arrowLen = 8;
      const a1x = endX - arrowLen * Math.cos(angle - 0.4);
      const a1y = endY - arrowLen * Math.sin(angle - 0.4);
      const a2x = endX - arrowLen * Math.cos(angle + 0.4);
      const a2y = endY - arrowLen * Math.sin(angle + 0.4);
      const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      arrow.setAttribute("points", `${endX},${endY} ${a1x},${a1y} ${a2x},${a2y}`);
      arrow.setAttribute("fill", "#ef4444");
      svg.appendChild(arrow);

      document.body.appendChild(svg);
    }
  });

  await snap(page, "n8n-step-5-fields-v2");
  await clearAnn(page);

  console.log("\nDone!");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
