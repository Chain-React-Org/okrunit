# Integration Screenshot Capture Guide

How to capture annotated screenshots for the `/docs/integrations` page. This process was used for Zapier and should be replicated for Make, n8n, GitHub Actions, monday.com, and future platforms.

## Prerequisites

- Playwright installed (`npx playwright --version`)
- `sharp` installed for webp conversion (`npm ls sharp`)
- An account on the target platform (Zapier, Make, etc.)

## Overview

The process has 3 phases:

1. **Login** - Open browser, sign in manually, save session cookies
2. **Capture** - Script navigates the platform UI, adds red annotation overlays, takes screenshots
3. **Wire into docs** - Add `DocsImage` components to the integrations page

## Phase 1: Save Login Session

Run the browser helper to open a login page. Sign in manually, then click **Resume** in the Playwright Inspector.

```bash
npx tsx tools/scripts/screenshots/browser.ts login <platform> <login-url>
```

Examples:
```bash
npx tsx tools/scripts/screenshots/browser.ts login zapier "https://zapier.com/app/login"
npx tsx tools/scripts/screenshots/browser.ts login make "https://www.make.com/en/login"
npx tsx tools/scripts/screenshots/browser.ts login n8n "https://app.n8n.cloud/signin"
npx tsx tools/scripts/screenshots/browser.ts login github "https://github.com/login"
npx tsx tools/scripts/screenshots/browser.ts login monday "https://auth.monday.com/login"
```

This saves cookies to `tools/scripts/screenshots/.auth/<platform>.json`. The session persists across runs until it expires.

## Phase 2: Capture Screenshots

### Approach: Inline Node.js Scripts

Rather than a monolithic capture script, we use inline `npx tsx -e "..."` scripts that:

1. Launch a headed browser with the saved session
2. Navigate to the target page
3. Click through the UI (using Playwright locators)
4. Inject red annotation overlays via `page.evaluate()`
5. Take a screenshot
6. Convert to webp via sharp

### Annotation Pattern

Annotations are injected as fixed-position `<div>` elements on top of the page before screenshotting:

```javascript
// Find the element's bounding box
const loc = page.locator('text=Request Approval').first();
const box = await loc.boundingBox(); // { x, y, width, height }

// Draw a red border + label
await page.evaluate(({ x, y, w, h }) => {
  const pad = 6;

  // Red border box
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    left: ${x - pad}px;
    top: ${y - pad}px;
    width: ${w + pad * 2}px;
    height: ${h + pad * 2}px;
    border: 3px solid #ef4444;
    border-radius: 12px;
    pointer-events: none;
    z-index: 99999;
    box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2);
  `;
  document.body.appendChild(overlay);

  // Red label pill
  const label = document.createElement('div');
  label.textContent = '4. Select Request Approval';
  label.style.cssText = `
    position: fixed;
    left: ${x + w + pad + 10}px;
    top: ${y + h / 2 - 14}px;
    background: #ef4444;
    color: #fff;
    font-size: 14px;
    font-weight: 600;
    font-family: -apple-system, sans-serif;
    padding: 5px 14px;
    border-radius: 8px;
    pointer-events: none;
    z-index: 99999;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  `;
  document.body.appendChild(label);
}, { x: box.x, y: box.y, w: box.width, h: box.height });
```

### Label Positioning

Place the label where it won't overlap important UI:
- **Right side** (default): `left: ${x + w + pad + 10}px`
- **Left side**: `left: ${x - pad - labelWidth - 10}px` (or use `right:`)
- **Top**: `top: ${y - pad - 32}px`
- **Bottom**: `top: ${y + h + pad + 6}px`

### Finding Elements

Use Playwright locators to find UI elements. Common patterns:

```javascript
// By text
page.locator('text=Request Approval').first()

// By placeholder
page.locator('input[placeholder*="Search"]').first()

// By button text
page.locator('button:has-text("Continue")').first()

// By role
page.locator('[role="combobox"]').first()

// Walking up to find a parent container
const parentBox = await loc.evaluate((el) => {
  let node = el;
  for (let i = 0; i < 10; i++) {
    if (!node.parentElement) break;
    node = node.parentElement;
    const r = node.getBoundingClientRect();
    if (r.width > 200 && r.height > 50 && r.height < 200) {
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    }
  }
  return null;
});
```

### Screenshot + Webp Conversion

```javascript
const sharp = require('sharp');
const png = path.join(OUTPUT, 'zapier-step-1-editor.png');
const webp = path.join(OUTPUT, 'zapier-step-1-editor.webp');
await page.screenshot({ path: png, type: 'png' });
await sharp(png).webp({ quality: 90 }).toFile(webp);
fs.unlinkSync(png);
```

### Full Example Script (Zapier)

See `tools/scripts/screenshots/zapier-all.ts` for the complete Zapier capture script. The pattern for each step is:

```javascript
// 1. Navigate or click to get to the right state
await page.goto('https://zapier.com/editor');
await page.waitForTimeout(4000);

// 2. Find the element to annotate
const actionBox = await parentBox(page, 'text=Select the event for your Zap to run');

// 3. Add annotation
if (actionBox) await annotate(page, actionBox, '1. Click Action');

// 4. Screenshot
await snap(page, 'zapier-step-1-editor');

// 5. Clear annotations before next step
await clearAnn(page);

// 6. Proceed to next state (click, type, etc.)
await page.locator('text=Select the event for your Zap to run').first().click();
```

### Debugging Tips

- If you can't find an element, take a debug screenshot first to see the current page state
- Use `await page.pause()` to open the Playwright Inspector and explore the DOM interactively
- Run `browser.ts login` again if the session expires
- Use `page.waitForTimeout(2000-4000)` after navigation/clicks. Third-party UIs are often slow
- If Next.js caches an old image, use a new filename (e.g., `-v2.webp`)

## Phase 3: Add to Docs Page

Add screenshots to `src/app/(docs)/docs/integrations/page.tsx` using the `DocsImage` component. Place images **outside** of `<ol>` or `<li>` elements (use a `<div>` wrapper instead):

```tsx
<div className="mt-4 space-y-2">
  <div className="flex gap-3 text-zinc-700">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">1</span>
    <span>In the Zap editor, click the <strong>Action</strong> step.</span>
  </div>
  <DocsImage
    src="/screenshots/docs/integrations/zapier-step-1-editor.webp"
    alt="Zapier editor showing the Action step highlighted"
    caption="Click the Action step in the Zap editor to add OKrunit."
  />

  <div className="flex gap-3 text-zinc-700">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-xs font-semibold text-zinc-700">2</span>
    <span>Search for <strong>"OKrunit"</strong> in the app search.</span>
  </div>
  <DocsImage
    src="/screenshots/docs/integrations/zapier-step-2-app-picker.webp"
    alt="Zapier app picker with the search bar highlighted"
    caption="Type 'OKrunit' in the search bar to find the app."
  />
</div>
```

**Important:** `DocsImage` renders a `<figure>` element which is not valid inside `<ol>`. Use a plain `<div>` wrapper with numbered spans instead of `<ol>`/`<li>`.

## File Structure

```
tools/scripts/screenshots/
├── README.md              ← This file
├── browser.ts             ← Login helper (saves session state)
├── interact.ts            ← Command-based browser control (optional)
├── zapier-all.ts          ← Full Zapier capture script
├── .auth/                 ← Saved login sessions (gitignored)
│   ├── zapier.json
│   ├── make.json
│   └── ...
└── .gitignore

public/screenshots/docs/integrations/
├── zapier-step-1-editor.webp
├── zapier-step-2-app-picker.webp
├── zapier-step-3-search-okrunit.webp
├── zapier-step-4b-request-approval.webp
├── zapier-step-5-account.webp
├── zapier-step-6-fields.webp
├── zapier-step-7-test-v2.webp
├── make-step-1-editor.webp        ← TODO
├── ...
```

## Naming Convention

```
<platform>-step-<number>-<description>.webp
```

Examples:
- `zapier-step-1-editor.webp`
- `make-step-3-select-module.webp`
- `n8n-step-4-credentials.webp`
- `github-step-2-workflow.webp`

## Checklist: New Platform Screenshots

For each new platform, capture these standard steps:

- [ ] **Editor/builder** - The main workflow editor before adding OKrunit
- [ ] **Search** - Typing "OKrunit" in the app/module search
- [ ] **Select OKrunit** - OKrunit appearing in search results
- [ ] **Select action** - Choosing the specific action (Request Approval, etc.)
- [ ] **Auth/connect** - The account connection or API key entry screen
- [ ] **Configure fields** - The field mapping/configuration screen
- [ ] **Test** - The test button or test results screen
- [ ] **Platform-specific** - Any unique steps (e.g., Make's webhook scenario, n8n's Wait node)

## Design Guidelines

- **Annotation color**: `#ef4444` (Tailwind red-500)
- **Border**: 3px solid with 4px outer glow at 20% opacity
- **Border radius**: 12px for boxes, 50% for small circular elements
- **Label**: 14px semibold, white text on red pill, 8px border-radius
- **Viewport**: 1440×900 at 2x device scale factor (retina)
- **Output format**: WebP at 90% quality
