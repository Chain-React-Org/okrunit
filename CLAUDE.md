# OKrunit

Human-in-the-loop approval gateway for automated workflows.

## Git Workflow — IMPORTANT

**NEVER push directly to `main`.** It is protected and will reject direct pushes.

Always use this workflow:
1. Commit changes to the `dev` branch
2. Push to dev: `git push origin dev`
3. A GitHub Action will automatically create a PR from `dev` to `main` and enable auto-merge
4. CI (lint, typecheck, tests, build) runs on the PR
5. If CI passes, the PR auto-merges to `main` via squash merge

**Always push to `dev`, never create feature branches.**

**NEVER force push to any branch. NEVER disable branch protection.**

## Database Migrations — IMPORTANT

When you create a Supabase migration file in `supabase/migrations/`, you **MUST** push it immediately:

```bash
supabase db push --include-all
```

Always push migrations right after creating them. Do NOT leave unpushed migrations — they will cause runtime errors when code depends on schema changes that haven't been applied to the remote database.

## Integration Docs Screenshots (Playwright)

When asked to capture screenshots for the `/docs/integrations` page (Zapier, Make, n8n, etc.):

### Setup
1. Save login session: `npx tsx tools/scripts/screenshots/browser.ts login <platform> <login-url>` — opens a browser, user signs in, clicks Resume in Playwright Inspector. Session saves to `tools/scripts/screenshots/.auth/<platform>.json`.
2. See `tools/scripts/screenshots/zapier-all.ts` as the reference script.

### Capture pattern
Use inline `npx tsx -e "..."` scripts or a dedicated `<platform>-all.ts` script that:
1. Launches headed Chromium with saved session state (viewport 1440×900, deviceScaleFactor 2)
2. Navigates and clicks through the platform UI using Playwright locators
3. Finds elements with `page.locator()` and gets their bounding box
4. Injects red annotation overlays via `page.evaluate()` (color `#ef4444`, 3px border, 12px radius, label pill with white text)
5. Takes PNG screenshot, converts to webp via `sharp` (quality 90)
6. Clears annotations before the next step

### Annotation code pattern
```javascript
const box = await page.locator('text=Request Approval').first().boundingBox();
await page.evaluate(({ x, y, w, h }) => {
  const pad = 6;
  const o = document.createElement('div');
  o.style.cssText = `position:fixed;left:${x-pad}px;top:${y-pad}px;width:${w+pad*2}px;height:${h+pad*2}px;border:3px solid #ef4444;border-radius:12px;pointer-events:none;z-index:99999;box-shadow:0 0 0 4px rgba(239,68,68,0.2);`;
  document.body.appendChild(o);
  const l = document.createElement('div');
  l.textContent = '4. Select Request Approval';
  l.style.cssText = `position:fixed;left:${x+w+pad+10}px;top:${y+h/2-14}px;background:#ef4444;color:#fff;font-size:14px;font-weight:600;font-family:-apple-system,sans-serif;padding:5px 14px;border-radius:8px;pointer-events:none;z-index:99999;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.15);`;
  document.body.appendChild(l);
}, { x: box.x, y: box.y, w: box.width, h: box.height });
```

### Adding to docs
- Output to `public/screenshots/docs/integrations/<platform>-step-<n>-<desc>.webp`
- Use `DocsImage` component in the integrations page — must be **outside** `<ol>`/`<li>` (use `<div>` wrapper with numbered spans instead)
- If Next.js caches an old image, use a new filename (append `-v2`)
- Full guide: `tools/scripts/screenshots/README.md`
