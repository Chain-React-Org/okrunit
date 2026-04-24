// Shared audit harness: opens a browser with the saved session and provides
// helpers for structured pass/fail reporting.

import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import * as fs from "fs";
import * as path from "path";

export const BASE = "https://okrunit.com";
export const STATE_PATH = "/tmp/claude-audit/state/auth.json";
export const SHOTS_DIR = "/tmp/claude-audit/shots";
export const REPORT_PATH = "/tmp/claude-audit/report.jsonl";

type Result = {
  phase: string;
  step: string;
  status: "pass" | "fail" | "warn" | "info";
  detail?: string;
  screenshot?: string;
};

export function log(result: Result) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.appendFileSync(REPORT_PATH, JSON.stringify(result) + "\n");
  const tag = result.status.toUpperCase();
  const extra = result.detail ? ` — ${result.detail}` : "";
  console.log(`[${tag}] ${result.phase} · ${result.step}${extra}`);
}

export async function openBrowser(): Promise<{
  browser: Browser;
  context: BrowserContext;
  page: Page;
}> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: STATE_PATH,
  });
  const page = await context.newPage();

  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  page.on("requestfailed", (req) => {
    // Ignore expected browser-only noise (CSP blocked beacons, etc.)
    if (req.url().includes("cloudflareinsights")) return;
    errors.push(`requestfailed: ${req.url()} ${req.failure()?.errorText}`);
  });
  // Capture 4xx/5xx responses (they don't fire requestfailed)
  page.on("response", (resp) => {
    const status = resp.status();
    if (status >= 400) {
      const url = resp.url();
      if (url.includes("cloudflareinsights")) return;
      errors.push(`response ${status}: ${url}`);
    }
  });
  // Expose errors array on page so caller can inspect
  (page as any)._collectedErrors = errors;

  return { browser, context, page };
}

export async function snap(page: Page, name: string): Promise<string> {
  fs.mkdirSync(SHOTS_DIR, { recursive: true });
  const file = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

export function errorsSince(page: Page, start: number): string[] {
  return ((page as any)._collectedErrors as string[]).slice(start);
}

export function errorCursor(page: Page): number {
  return ((page as any)._collectedErrors as string[]).length;
}
