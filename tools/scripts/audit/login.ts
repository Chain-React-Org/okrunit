// Headless login flow. Saves session state to /tmp/claude-audit/state/auth.json
// so subsequent audit scripts can reuse it without re-authenticating. Also
// persists /tmp/claude-audit/user_id and /tmp/claude-audit/org_id so audit
// scripts that need those identifiers can pick them up.

import { chromium } from "playwright";
import * as fs from "fs";
import { execSync } from "child_process";

// If email/password files are present and non-empty we'll pre-fill the form
// as a convenience, otherwise the user logs in interactively.
function readOptional(path: string): string {
  try {
    return fs.readFileSync(path, "utf8").trim();
  } catch {
    return "";
  }
}
const EMAIL = readOptional("/tmp/claude-audit/email");
const PASSWORD = readOptional("/tmp/claude-audit/password");
const STATE_PATH = "/tmp/claude-audit/state/auth.json";
const BASE = "https://okrunit.com";

function sqlQuery(sql: string): { rows: any[] } {
  const tmp = "/tmp/claude-audit/.login-query.sql";
  fs.writeFileSync(tmp, sql);
  const out = execSync(
    `cd /Users/nathanielstoddard/okrunit && npx supabase db query --linked "$(cat ${tmp})"`,
    { encoding: "utf8", shell: "/bin/bash" },
  );
  const startIdx = out.indexOf("{");
  const jsonPart = out.slice(startIdx, out.lastIndexOf("}") + 1);
  return JSON.parse(jsonPart);
}

function decodeJwtSub(jwt: string): string | null {
  try {
    const payload = jwt.split(".")[1];
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).sub ?? null;
  } catch {
    return null;
  }
}

function userIdFromCookies(cookies: Array<{ name: string; value: string }>): string | null {
  const authCookies = cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (authCookies.length === 0) return null;

  let raw = authCookies.map((c) => decodeURIComponent(c.value)).join("");
  if (raw.startsWith("base64-")) {
    raw = Buffer.from(raw.slice("base64-".length), "base64").toString("utf8");
  }
  let token: string | null = null;
  try {
    const p = JSON.parse(raw);
    if (Array.isArray(p) && typeof p[0] === "string") token = p[0];
    else if (typeof p?.access_token === "string") token = p.access_token;
  } catch {
    if (raw.split(".").length === 3) token = raw;
  }
  return token ? decodeJwtSub(token) : null;
}

function persistOrgIdForUser(userId: string) {
  const membership = sqlQuery(
    `SELECT org_id, role FROM org_memberships WHERE user_id = '${userId}' ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END LIMIT 1;`,
  ).rows[0];
  if (!membership?.org_id) throw new Error(`No org_memberships for user ${userId}`);
  fs.writeFileSync("/tmp/claude-audit/org_id", membership.org_id);
  console.log(`✅ org_id=${membership.org_id} role=${membership.role}`);
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  page.on("pageerror", (err) => console.error("PAGE ERROR:", err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error("CONSOLE ERROR:", msg.text());
  });

  console.log("Opening /login...");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  console.log("URL after goto:", page.url());

  if (EMAIL && PASSWORD) {
    console.log("Pre-filling email/password from /tmp/claude-audit/...");
    await page.getByLabel(/email/i).fill(EMAIL);
    await page.getByLabel(/password/i).fill(PASSWORD);
    await page.getByRole("button", { name: /sign in|log ?in/i }).first().click();
  } else {
    console.log("👉 Browser is open. Please sign in manually. Waiting up to 5 min...");
  }

  // Wait for the user to land back on an authenticated okrunit page. The
  // OAuth flow bounces through google.com, so just "URL no longer /login" is
  // not enough. Require the host to be okrunit.com AND not on /login.
  try {
    await page.waitForURL(
      (url) => url.hostname === "okrunit.com" && !url.pathname.startsWith("/login"),
      { timeout: 5 * 60 * 1000 },
    );
  } catch (e) {
    console.error("Did not return to okrunit.com (off /login) within 5 minutes");
    await page.screenshot({ path: "/tmp/claude-audit/shots/login-stuck.png", fullPage: true });
    await browser.close();
    process.exit(1);
  }

  console.log("Landed at:", page.url());
  await page.screenshot({ path: "/tmp/claude-audit/shots/01-after-login.png", fullPage: true });

  // Save auth state
  await context.storageState({ path: STATE_PATH });
  console.log(`✅ Saved storage state to ${STATE_PATH}`);

  // Persist user_id from the Supabase JWT cookie, then look up org_id by SQL.
  const cookies = await context.cookies();
  const userId = userIdFromCookies(cookies);
  if (!userId) {
    throw new Error("Could not extract user_id from supabase auth cookies");
  }
  fs.writeFileSync("/tmp/claude-audit/user_id", userId);
  console.log(`✅ user_id=${userId}`);
  persistOrgIdForUser(userId);

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
