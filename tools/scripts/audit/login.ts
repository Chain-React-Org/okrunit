// Headless login flow. Saves session state to /tmp/claude-audit/state/auth.json
// so subsequent audit scripts can reuse it without re-authenticating.

import { chromium } from "playwright";
import * as fs from "fs";

const EMAIL = fs.readFileSync("/tmp/claude-audit/email", "utf8").trim();
const PASSWORD = fs.readFileSync("/tmp/claude-audit/password", "utf8").trim();
const STATE_PATH = "/tmp/claude-audit/state/auth.json";
const BASE = "https://okrunit.com";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("pageerror", (err) => console.error("PAGE ERROR:", err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("CONSOLE ERROR:", msg.text());
  });

  console.log("Opening /login...");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  console.log("URL after goto:", page.url());

  // Fill email + password (shadcn forms usually have name attributes)
  await page.getByLabel(/email/i).fill(EMAIL);
  await page.getByLabel(/password/i).fill(PASSWORD);

  // Click the submit button
  const submit = page.getByRole("button", { name: /sign in|log ?in/i }).first();
  await submit.click();

  // Wait for navigation away from /login
  try {
    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15000 });
  } catch (e) {
    console.error("Did not navigate away from /login within 15s");
    await page.screenshot({ path: "/tmp/claude-audit/shots/login-stuck.png", fullPage: true });
    const body = await page.textContent("body");
    console.error("Body text snippet:", body?.slice(0, 500));
    await browser.close();
    process.exit(1);
  }

  console.log("Landed at:", page.url());
  await page.screenshot({ path: "/tmp/claude-audit/shots/01-after-login.png", fullPage: true });

  // Save auth state
  await context.storageState({ path: STATE_PATH });
  console.log(`✅ Saved storage state to ${STATE_PATH}`);

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
