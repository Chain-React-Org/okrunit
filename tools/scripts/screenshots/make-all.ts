// Capture all Make.com integration screenshots in one run
// Usage: npx tsx tools/scripts/screenshots/make-all.ts
//
// Prerequisites:
//   npx tsx tools/scripts/screenshots/browser.ts login make "https://www.make.com/en/login"

import { chromium, type Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const STATE_DIR = path.join(process.cwd(), "tools/scripts/screenshots/.auth");
const OUTPUT_DIR = path.join(process.cwd(), "public/screenshots/docs/integrations");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const sharp = require("sharp");

async function snap(page: Page, name: string) {
  const png = path.join(OUTPUT_DIR, `${name}.png`);
  const webp = path.join(OUTPUT_DIR, `${name}.webp`);
  await page.screenshot({ path: png, type: "png", timeout: 60000 });
  await sharp(png).webp({ quality: 90 }).toFile(webp);
  fs.unlinkSync(png);
  console.log(`✅ ${name}.webp`);
}

async function annotate(page: Page, box: { x: number; y: number; width: number; height: number }, label: string, side: "right" | "left" | "top" | "bottom" = "right") {
  const { x, y, width: w, height: h } = box;
  await page.evaluate(({ x, y, w, h, label, side }) => {
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
  }, { x, y, w, h, label, side });
}

async function clearAnn(page: Page) {
  await page.evaluate(() => document.querySelectorAll(".ann").forEach(e => e.remove()));
}

/** Annotate multiple fields with circles and draw a connecting line + arrow from a label pill to all of them */
async function annotateFieldsWithConnector(
  page: Page,
  fields: { x: number; y: number; width: number; height: number }[],
  label: string,
  labelSide: "left" | "right" = "left"
) {
  await page.evaluate(({ fields, label, labelSide }) => {
    const pad = 6;
    const color = "#ef4444";

    // Draw circle around each field
    const centers: { cx: number; cy: number }[] = [];
    for (const f of fields) {
      const o = document.createElement("div");
      o.className = "ann";
      o.style.cssText = `position:fixed;left:${f.x - pad}px;top:${f.y - pad}px;width:${f.width + pad * 2}px;height:${f.height + pad * 2}px;border:3px solid ${color};border-radius:12px;pointer-events:none;z-index:99999;box-shadow:0 0 0 4px rgba(239,68,68,0.2);`;
      document.body.appendChild(o);
      centers.push({ cx: f.x + f.width / 2, cy: f.y + f.height / 2 });
    }

    // Compute label position: vertically centered across all fields, offset to the chosen side
    const minY = Math.min(...fields.map(f => f.y));
    const maxY = Math.max(...fields.map(f => f.y + f.height));
    const midY = (minY + maxY) / 2;
    const leftEdge = Math.min(...fields.map(f => f.x));
    const rightEdge = Math.max(...fields.map(f => f.x + f.width));

    const labelX = labelSide === "left" ? leftEdge - pad - 220 : rightEdge + pad + 20;
    const labelY = midY - 14;

    // Draw label pill
    const l = document.createElement("div");
    l.className = "ann";
    l.textContent = label;
    l.style.cssText = `position:fixed;left:${labelX}px;top:${labelY}px;background:${color};color:#fff;font-size:14px;font-weight:600;font-family:-apple-system,sans-serif;padding:5px 14px;border-radius:8px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
    document.body.appendChild(l);

    // Draw SVG overlay with connecting lines + arrows from label to each field circle
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.className.baseVal = "ann";
    svg.style.cssText = `position:fixed;left:0;top:0;width:100vw;height:100vh;pointer-events:none;z-index:99998;`;

    // Arrow marker definition
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
    marker.setAttribute("id", "ann-arrow");
    marker.setAttribute("markerWidth", "8");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("refX", "8");
    marker.setAttribute("refY", "3");
    marker.setAttribute("orient", "auto");
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    arrow.setAttribute("points", "0 0, 8 3, 0 6");
    arrow.setAttribute("fill", color);
    marker.appendChild(arrow);
    defs.appendChild(marker);
    svg.appendChild(defs);

    // Label pill center (approximate — pill is ~200px wide, 28px tall)
    const pillCx = labelSide === "left" ? labelX + 100 : labelX + 100;
    const pillCy = labelY + 14;
    const pillEdgeX = labelSide === "left" ? labelX + 200 + 4 : labelX - 4;

    for (const c of centers) {
      // Line from pill edge to the field circle edge
      const targetX = labelSide === "left" ? c.cx - pad - 6 : c.cx + pad + 6;
      // Inset the target slightly so arrow tip touches the circle border
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", String(pillEdgeX));
      line.setAttribute("y1", String(pillCy));
      line.setAttribute("x2", String(targetX));
      line.setAttribute("y2", String(c.cy));
      line.setAttribute("stroke", color);
      line.setAttribute("stroke-width", "2");
      line.setAttribute("stroke-dasharray", "6,3");
      line.setAttribute("marker-end", "url(#ann-arrow)");
      svg.appendChild(line);
    }

    document.body.appendChild(svg);
  }, { fields, label, labelSide });
}

async function main() {
  const statePath = path.join(STATE_DIR, "make.json");
  if (!fs.existsSync(statePath)) {
    console.error('No Make login state. Run:\n  npx tsx tools/scripts/screenshots/browser.ts login make "https://www.make.com/en/login"');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: false, args: ["--window-size=1440,900"] });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    storageState: statePath,
  });
  const page = await ctx.newPage();

  // ---- Step 1: Navigate to Make dashboard and create new scenario ----
  console.log("\n📸 Step 1: Scenario editor — add module...");
  // Navigate to Make app dashboard — go to root, let it redirect to the right page
  await page.goto("https://us2.make.com");
  await page.waitForTimeout(5000);

  // Log where we ended up
  console.log(`  Current URL: ${page.url()}`);
  await snap(page, "make-debug-landing");

  // If we landed on a login page, the session may have expired
  if (page.url().includes("login")) {
    console.error("❌ Session expired. Re-run login:\n  npx tsx tools/scripts/screenshots/browser.ts login make \"https://www.make.com/en/login\"");
    await browser.close();
    process.exit(1);
  }

  // Look for "Scenarios" in the left sidebar or navigation to click into it
  const scenarioNav = page.locator('a:has-text("Scenarios"), [href*="scenario"], nav >> text=Scenarios').first();
  if (await scenarioNav.isVisible({ timeout: 5000 }).catch(() => false)) {
    await scenarioNav.click();
    await page.waitForTimeout(3000);
    console.log(`  After Scenarios click: ${page.url()}`);
  }

  // Click "Create a new scenario"
  const createBtn = page.locator('button:has-text("Create a new scenario"), a:has-text("Create a new scenario"), button:has-text("new scenario"), button:has-text("Create scenario")').first();
  if (await createBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
    await createBtn.click();
    await page.waitForTimeout(5000);
  } else {
    // Try any prominent "Create" or "+" button
    const altCreate = page.locator('button:has-text("Create"), a >> text=Create').first();
    if (await altCreate.isVisible({ timeout: 3000 }).catch(() => false)) {
      await altCreate.click();
      await page.waitForTimeout(5000);
    }
  }

  console.log(`  Editor URL: ${page.url()}`);

  // Wait for the editor to fully load — Make often shows a "Recover unsaved changes?" modal
  await page.waitForTimeout(4000);

  // Dismiss recovery modal — try multiple approaches
  // First try the X close button
  const closeX = page.locator('button[aria-label="Close"], button[aria-label="close"], .close-button, imt-scenario-recovery-modal button').first();
  if (await closeX.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("  Closing recovery modal via X...");
    await closeX.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // Try the Discard button with force click
  const discardBtn = page.locator('button:has-text("Discard")').first();
  if (await discardBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    console.log("  Dismissing recovery modal via Discard...");
    await discardBtn.click({ force: true });
    await page.waitForTimeout(2000);
  }

  // If modal still present, try clicking its backdrop or pressing Escape
  if (await page.locator('text=Recover unsaved changes').isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log("  Trying Escape key to dismiss modal...");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2000);
  }

  // Last resort: use JavaScript to remove the modal element
  if (await page.locator('text=Recover unsaved changes').isVisible({ timeout: 1000 }).catch(() => false)) {
    console.log("  Force-removing recovery modal via JS...");
    await page.evaluate(() => {
      const modal = document.querySelector('imt-scenario-recovery-modal');
      if (modal) modal.remove();
      // Also remove any backdrop/overlay
      document.querySelectorAll('[class*="modal-backdrop"], [class*="overlay"]').forEach(el => el.remove());
    });
    await page.waitForTimeout(1000);
  }

  // The + button in Make's editor opens an app picker popup automatically
  // on new scenarios, or we click the center of the canvas to trigger it.
  // Use the fallback coordinates that worked in earlier runs.
  let addBox: { x: number; y: number; width: number; height: number } | null = null;

  // Try finding the + via known selectors first
  const plusSelectors = [
    '[data-testid="add-module"]',
    'button[aria-label*="Add"]',
    '.imt-add-module',
    '[class*="add-module"]',
  ];
  for (const sel of plusSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      addBox = await el.boundingBox();
      if (addBox && addBox.width > 40) {
        console.log(`  Found + with selector: ${sel}`);
        break;
      }
      addBox = null;
    }
  }

  if (!addBox) {
    console.log("  Using center fallback for + button");
    // These coordinates worked in earlier successful runs (v7/v8)
    addBox = { x: 680, y: 420, width: 60, height: 60 };
  }

  // Click the + to open the app picker (it auto-opens on new scenarios too)
  await page.mouse.click(addBox.x + addBox.width / 2, addBox.y + addBox.height / 2);
  await page.waitForTimeout(3000);

  // Step 1 screenshot: show the editor with the app picker open, annotate the + area
  // The + circle is the large purple element — find its visible bounding box for annotation
  // We annotate it even though the picker is open, to show WHERE the user clicked
  const plusCircle = await page.evaluate(() => {
    // Find the large purple circle by looking for SVG/canvas elements
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      // Look for large circular purple-ish element
      if (r.width > 80 && r.width < 250 && Math.abs(r.width - r.height) < 20 &&
          r.x > 50 && r.y > 30 && style.borderRadius) {
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }
    }
    return null;
  });

  if (plusCircle) {
    await annotate(page, plusCircle, "1. Click + to add a module", "left");
  } else {
    // Annotate at the known position
    await annotate(page, { x: 250, y: 100, width: 130, height: 130 }, "1. Click + to add a module", "left");
  }
  await snap(page, "make-step-1-editor");
  await clearAnn(page);

  // ---- Step 2: App picker — search for OKrunit ----
  console.log("\n📸 Step 2: App picker — search...");

  const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="search"], input[type="text"]').first();
  const searchBox = await searchInput.boundingBox().catch(() => null);
  if (searchBox) {
    await annotate(page, searchBox, '2. Search for "OKrunit"', "left");
    await snap(page, "make-step-2-search");
    await clearAnn(page);
  } else {
    console.log("  ⚠️  Search input not found");
    await snap(page, "make-step-2-search");
  }

  // ---- Step 3: Type OKrunit and show result ----
  console.log("\n📸 Step 3: Search results...");
  if (searchBox) {
    await searchInput.fill("OKrunit");
    await page.waitForTimeout(3000);
  }

  // Look for OKrunit in the results
  const okrunitResult = page.locator('text=OKrunit').first();
  if (await okrunitResult.isVisible({ timeout: 5000 }).catch(() => false)) {
    const okrunitBox = await okrunitResult.boundingBox();
    if (okrunitBox) await annotate(page, okrunitBox, "3. Select OKrunit", "right");
    await snap(page, "make-step-3-select-okrunit");
    await clearAnn(page);

    // Click OKrunit
    await okrunitResult.click();
    await page.waitForTimeout(3000);
  } else {
    console.log("  ⚠️  OKrunit not found in search results — taking debug screenshot");
    await snap(page, "make-step-3-debug");
  }

  // ---- Step 4: Select the module (Request an Approval) ----
  console.log("\n📸 Step 4: Select module...");
  // After clicking OKrunit, Make shows Triggers at top and Actions below.
  // "Request an Approval" is under Actions, below the fold in the panel's scroll container.
  // We need to scroll the panel's own scrollable container (not the page).

  // Find the scrollable parent of the module list and scroll it down
  // to bring "Request an Approval" into view
  const approvalEl = page.locator('text="Request an Approval"').first();

  // Scroll the panel container that holds the modules list
  await page.evaluate(() => {
    // Find the element with "Request an Approval" text
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let targetNode: Node | null = null;
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.trim() === 'Request an Approval') {
        targetNode = walker.currentNode;
        break;
      }
    }
    if (targetNode) {
      // Walk up to find the scrollable ancestor
      let el = targetNode.parentElement;
      while (el) {
        if (el.scrollHeight > el.clientHeight + 20) {
          el.scrollTop = el.scrollHeight;
          break;
        }
        el = el.parentElement;
      }
      // Also try scrollIntoView on the element itself
      (targetNode.parentElement as HTMLElement)?.scrollIntoView({ block: 'center' });
    }
  });
  await page.waitForTimeout(1500);

  if (await approvalEl.isVisible({ timeout: 3000 }).catch(() => false)) {
    const caBox = await approvalEl.boundingBox();
    if (caBox) {
      await annotate(page, caBox, "4. Choose Request an Approval");
      await snap(page, "make-step-4-select-module");
      await clearAnn(page);
      await approvalEl.click({ force: true, timeout: 10000 });
      await page.waitForTimeout(3000);
    }
  } else {
    console.log("  ⚠️  'Request an Approval' not visible after scrolling");
    await snap(page, "make-step-4-debug");
  }

  // ---- Step 5: Connection — Add/select OKrunit connection ----
  console.log("\n📸 Step 5: Connection setup...");
  await page.waitForTimeout(2000);

  // Look for the Connection section with the "Add" button
  const addBtn = page.locator('button:has-text("Add")').first();
  if (await addBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    const addBox2 = await addBtn.boundingBox();
    if (addBox2) {
      // Annotate the Add button with label to the left (right side would be clipped)
      await annotate(page, addBox2, "5. Click Add to connect", "left");
      await snap(page, "make-step-5-connection");
      await clearAnn(page);
    }
  } else {
    console.log("  ⚠️  Add button not found");
    await snap(page, "make-step-5-connection");
  }

  // ---- Step 6: Configure fields (multi-field annotation with connecting arrows) ----
  console.log("\n📸 Step 6: Configure fields...");
  await page.waitForTimeout(2000);

  // Collect bounding boxes for all configurable fields
  const fieldLabelTexts = [
    "What needs approval?",
    "Details",
    "Callback URL",
    "Scenario URL",
  ];
  const fieldBoxes: { x: number; y: number; width: number; height: number }[] = [];

  for (const labelText of fieldLabelTexts) {
    const el = page.locator(`text="${labelText}"`).first();
    if (await el.isVisible({ timeout: 2000 }).catch(() => false)) {
      const labelBox = await el.boundingBox();
      if (labelBox) {
        // Try to find the associated input/textarea near this label
        const inputBox = await page.evaluate((lt) => {
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            if (walker.currentNode.textContent?.trim() === lt) {
              let container = walker.currentNode.parentElement;
              while (container) {
                const input = container.querySelector('input, textarea');
                if (input) {
                  const r = input.getBoundingClientRect();
                  if (r.width > 30) return { x: r.x, y: r.y, width: r.width, height: r.height };
                }
                if (container.nextElementSibling) {
                  const input2 = container.nextElementSibling.querySelector('input, textarea');
                  if (input2) {
                    const r = input2.getBoundingClientRect();
                    if (r.width > 30) return { x: r.x, y: r.y, width: r.width, height: r.height };
                  }
                  if (container.nextElementSibling.tagName === 'INPUT' || container.nextElementSibling.tagName === 'TEXTAREA') {
                    const r = container.nextElementSibling.getBoundingClientRect();
                    if (r.width > 30) return { x: r.x, y: r.y, width: r.width, height: r.height };
                  }
                }
                container = container.parentElement;
              }
              break;
            }
          }
          return null;
        }, labelText);

        fieldBoxes.push(inputBox || labelBox);
      }
    }
  }

  if (fieldBoxes.length >= 2) {
    await annotateFieldsWithConnector(page, fieldBoxes, "6. Configure these fields", "left");
  } else if (fieldBoxes.length === 1) {
    await annotate(page, fieldBoxes[0], "6. Configure the request fields", "left");
  } else {
    console.log("  ⚠️  No configurable fields found");
  }
  await snap(page, "make-step-6-fields");
  await clearAnn(page);

  // ---- Scenario 2: Webhook scenario (handle the decision) ----
  // Create a NEW scenario for the webhook trigger, capturing the same initial steps
  console.log("\n📸 Scenario 2: Creating webhook scenario...");

  // Navigate back to scenarios list
  await page.goto("https://us2.make.com");
  await page.waitForTimeout(5000);

  const scenarioNav2 = page.locator('a:has-text("Scenarios"), [href*="scenario"], nav >> text=Scenarios').first();
  if (await scenarioNav2.isVisible({ timeout: 5000 }).catch(() => false)) {
    await scenarioNav2.click();
    await page.waitForTimeout(3000);
  }

  // Create a new scenario
  const createBtn2 = page.locator('button:has-text("Create a new scenario"), a:has-text("Create a new scenario"), button:has-text("new scenario"), button:has-text("Create scenario")').first();
  if (await createBtn2.isVisible({ timeout: 8000 }).catch(() => false)) {
    await createBtn2.click();
    await page.waitForTimeout(5000);
  } else {
    const altCreate2 = page.locator('button:has-text("Create"), a >> text=Create').first();
    if (await altCreate2.isVisible({ timeout: 3000 }).catch(() => false)) {
      await altCreate2.click();
      await page.waitForTimeout(5000);
    }
  }

  // Dismiss recovery modal if it appears
  await page.waitForTimeout(4000);
  const closeX2 = page.locator('button[aria-label="Close"], button[aria-label="close"], .close-button').first();
  if (await closeX2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await closeX2.click({ force: true });
    await page.waitForTimeout(2000);
  }
  const discardBtn2 = page.locator('button:has-text("Discard")').first();
  if (await discardBtn2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await discardBtn2.click({ force: true });
    await page.waitForTimeout(2000);
  }
  if (await page.locator('text=Recover unsaved changes').isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(2000);
  }

  // ---- Step 7: Click + to add a module (same as step 1 but for scenario 2) ----
  console.log("\n📸 Step 7: Scenario 2 — add module...");
  let addBox3: { x: number; y: number; width: number; height: number } | null = null;
  for (const sel of plusSelectors) {
    const el = page.locator(sel).first();
    if (await el.isVisible({ timeout: 1000 }).catch(() => false)) {
      addBox3 = await el.boundingBox();
      if (addBox3 && addBox3.width > 40) break;
      addBox3 = null;
    }
  }
  if (!addBox3) addBox3 = { x: 680, y: 420, width: 60, height: 60 };

  await page.mouse.click(addBox3.x + addBox3.width / 2, addBox3.y + addBox3.height / 2);
  await page.waitForTimeout(3000);

  // ---- Step 8: Search for "Webhooks" and select Custom webhook ----
  console.log("\n📸 Step 8: Scenario 2 — search for Webhooks...");
  const searchInput2 = page.locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="search"], input[type="text"]').first();
  if (await searchInput2.isVisible({ timeout: 3000 }).catch(() => false)) {
    await searchInput2.fill("Webhooks");
    await page.waitForTimeout(3000);
  }

  // Find and click "Webhooks" in results
  const webhooksResult = page.locator('text=Webhooks').first();
  if (await webhooksResult.isVisible({ timeout: 5000 }).catch(() => false)) {
    const whBox = await webhooksResult.boundingBox();
    if (whBox) await annotate(page, whBox, "7. Select Webhooks", "right");
    await snap(page, "make-step-7-search-webhooks");
    await clearAnn(page);

    await webhooksResult.click();
    await page.waitForTimeout(3000);
  } else {
    console.log("  ⚠️  Webhooks not found in search results");
    await snap(page, "make-step-7-debug");
  }

  // ---- Step 9: Select "Custom webhook" trigger ----
  console.log("\n📸 Step 9: Scenario 2 — select Custom webhook...");
  const customWebhook = page.locator('text="Custom webhook"').first();

  // Scroll the panel to find it
  await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      if (walker.currentNode.textContent?.trim() === 'Custom webhook') {
        let el = walker.currentNode.parentElement;
        while (el) {
          if (el.scrollHeight > el.clientHeight + 20) {
            el.scrollTop = 0;
            break;
          }
          el = el.parentElement;
        }
        (walker.currentNode.parentElement as HTMLElement)?.scrollIntoView({ block: 'center' });
        break;
      }
    }
  });
  await page.waitForTimeout(1500);

  if (await customWebhook.isVisible({ timeout: 3000 }).catch(() => false)) {
    const cwBox = await customWebhook.boundingBox();
    if (cwBox) {
      await annotate(page, cwBox, "8. Choose Custom webhook");
      await snap(page, "make-step-8-custom-webhook");
      await clearAnn(page);
      await customWebhook.click({ force: true, timeout: 10000 });
      await page.waitForTimeout(3000);
    }
  } else {
    console.log("  ⚠️  'Custom webhook' not visible");
    await snap(page, "make-step-8-debug");
  }

  // ---- Step 10: Copy the webhook URL ----
  console.log("\n📸 Step 10: Scenario 2 — copy webhook URL...");
  await page.waitForTimeout(2000);

  // After selecting Custom webhook, Make shows a panel with "Add" button to create the hook
  // and then displays the URL. Look for the URL or the "Copy address to clipboard" button.
  const addHookBtn = page.locator('button:has-text("Add")').first();
  if (await addHookBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await addHookBtn.click();
    await page.waitForTimeout(3000);
  }

  // Look for the webhook URL display — usually an input or text containing "hook.us2.make.com" or similar
  const webhookUrl = page.locator('input[value*="hook"], input[value*="make.com"], text=/https:\\/\\/hook/').first();
  const copyBtn = page.locator('button:has-text("Copy"), button[aria-label*="Copy"], button[aria-label*="copy"]').first();

  let urlFound = false;
  if (await webhookUrl.isVisible({ timeout: 5000 }).catch(() => false)) {
    const urlBox = await webhookUrl.boundingBox();
    if (urlBox) {
      await annotate(page, urlBox, "9. Copy this webhook URL", "left");
      await snap(page, "make-step-9-copy-webhook-url");
      await clearAnn(page);
      urlFound = true;
    }
  }

  if (!urlFound && await copyBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    const copyBox = await copyBtn.boundingBox();
    if (copyBox) {
      await annotate(page, copyBox, "9. Copy this webhook URL", "left");
      await snap(page, "make-step-9-copy-webhook-url");
      await clearAnn(page);
      urlFound = true;
    }
  }

  if (!urlFound) {
    console.log("  ⚠️  Webhook URL not found — taking current state");
    await snap(page, "make-step-9-webhook-url");
  }

  console.log("\n🎉 Make screenshots complete!");
  await ctx.storageState({ path: statePath });
  await browser.close();
}

main().catch(console.error);
