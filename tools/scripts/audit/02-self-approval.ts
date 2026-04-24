// Audit 2: Self-approval toggle end-to-end.
//
// Seeds two self-created approval requests directly via SQL (bypassing
// Zapier/OAuth for speed). Then:
//   a) With allow_self_approval=false: open request, verify no decide buttons
//      + blocker message renders.
//   b) Toggle allow_self_approval=true via the PATCH /api/v1/org endpoint.
//   c) Reload: verify decide buttons appear.
//   d) Click Approve via API (session) — verify 200/no SELF_APPROVAL_BLOCKED.

import { openBrowser, snap, log, errorCursor, errorsSince, BASE, STATE_PATH } from "./harness";
import * as fs from "fs";
import { execSync } from "child_process";

const USER_ID = fs.readFileSync("/tmp/claude-audit/user_id", "utf8").trim();
const ORG_ID = fs.readFileSync("/tmp/claude-audit/org_id", "utf8").trim();

function sql(query: string): any {
  // Write to a temp file to avoid shell-escaping headaches.
  const tmp = `/tmp/claude-audit/.query.sql`;
  fs.writeFileSync(tmp, query);
  const out = execSync(
    `cd /Users/nathanielstoddard/okrunit && npx supabase db query --linked "$(cat ${tmp})"`,
    { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], shell: "/bin/bash" },
  );
  const startIdx = out.indexOf("{");
  const jsonPart = out.slice(startIdx, out.lastIndexOf("}") + 1);
  return JSON.parse(jsonPart);
}

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function seedApproval(title: string): string {
  const result = sql(
    `INSERT INTO approval_requests (org_id, title, description, status, priority, created_by, required_approvals, current_approvals, is_sequential, is_log) VALUES ('${ORG_ID}', '${sqlEscape(title)}', 'Seeded by audit script', 'pending', 'medium', jsonb_build_object('type','session','user_id','${USER_ID}'), 1, 0, false, false) RETURNING id;`,
  );
  return result.rows[0].id as string;
}

function setAllowSelfApproval(value: boolean) {
  sql(`UPDATE organizations SET allow_self_approval = ${value} WHERE id = '${ORG_ID}';`);
}

async function main() {
  const phase = "Audit 2 (self-approval)";

  // Ensure starting state
  setAllowSelfApproval(false);
  const id1 = seedApproval("Audit: self-approval off test");
  log({ phase, step: "seed pending self-created approval", status: "pass", detail: `id=${id1}` });

  const { browser, context, page } = await openBrowser();

  // Helper: open a request by clicking its card, then wait for the Sheet.
  // The ?open= query param approach proved flaky (router.replace cleans the
  // URL before the sheet fully mounts in some timings); clicking is what
  // the user actually does.
  async function openDetailAndSnap(id: string, tag: string, title: string) {
    await page.goto(`${BASE}/requests`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

    // Find the list card for this approval by its visible title and click.
    // Cards are clickable regions (not buttons) — click by title text.
    const titleLocator = page.getByText(title, { exact: false }).first();
    await titleLocator.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    await titleLocator.click({ trial: false });

    const sheet = page.getByRole("dialog");
    await sheet.first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    const sheetOpened = (await sheet.count()) > 0;
    const shot = await snap(page, tag);
    const sheetText = sheetOpened ? (await sheet.first().textContent()) ?? "" : "";
    const seesBlockCopy = /you created this request/i.test(sheetText);
    const approveBtn = sheetOpened
      ? await sheet.first().getByRole("button", { name: /^approve$/i }).count()
      : 0;
    const rejectBtn = sheetOpened
      ? await sheet.first().getByRole("button", { name: /^reject$/i }).count()
      : 0;
    return { shot, sheetOpened, seesBlockCopy, approveBtn, rejectBtn, sheetText };
  }

  // Scenario A: flag OFF
  {
    const errStart = errorCursor(page);
    const r = await openDetailAndSnap(id1, "02a-flag-off-detail", "Audit: self-approval off test");
    log({
      phase,
      step: "flag OFF: detail view",
      status: r.sheetOpened && r.seesBlockCopy && r.approveBtn === 0 && r.rejectBtn === 0 ? "pass" : "fail",
      detail: `sheet=${r.sheetOpened} blockCopyVisible=${r.seesBlockCopy} approveBtns=${r.approveBtn} rejectBtns=${r.rejectBtn}`,
      screenshot: r.shot,
    });
    const errs = errorsSince(page, errStart).filter(e => !/gravatar|_rsc=|ERR_ABORTED|cloudflare/.test(e));
    if (errs.length) for (const e of errs) log({ phase, step: "flag OFF errors", status: "warn", detail: e });
  }

  // Flip flag via UI → API
  {
    // Use the session cookie from the browser context to PATCH /api/v1/org
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const resp = await page.request.patch(`${BASE}/api/v1/org`, {
      data: { allow_self_approval: true },
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    });
    const body = await resp.json();
    log({
      phase,
      step: "PATCH /api/v1/org allow_self_approval=true",
      status: resp.ok() && body.data?.allow_self_approval === true ? "pass" : "fail",
      detail: `status=${resp.status()} persisted=${body.data?.allow_self_approval}`,
    });
  }

  // Scenario B: flag ON, reload detail
  {
    const errStart = errorCursor(page);
    const r = await openDetailAndSnap(id1, "02b-flag-on-detail", "Audit: self-approval off test");
    log({
      phase,
      step: "flag ON: detail view shows decide buttons",
      status: r.sheetOpened && !r.seesBlockCopy && r.approveBtn > 0 && r.rejectBtn > 0 ? "pass" : "fail",
      detail: `sheet=${r.sheetOpened} blockCopyVisible=${r.seesBlockCopy} approveBtns=${r.approveBtn} rejectBtns=${r.rejectBtn}`,
      screenshot: r.shot,
    });
    const errs = errorsSince(page, errStart).filter(e => !/gravatar|_rsc=|ERR_ABORTED|cloudflare/.test(e));
    if (errs.length) for (const e of errs) log({ phase, step: "flag ON errors", status: "warn", detail: e });
  }

  // Scenario C: actually approve via the API as our self-user
  {
    const cookies = await context.cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const resp = await page.request.patch(`${BASE}/api/v1/approvals/${id1}`, {
      data: { decision: "approve", comment: "audit self-approve" },
      headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    });
    const text = await resp.text();
    let parsed: any; try { parsed = JSON.parse(text); } catch { parsed = text; }
    log({
      phase,
      step: "PATCH /api/v1/approvals/:id decision=approve as creator",
      status: resp.ok() && parsed?.status === "approved" ? "pass" : "fail",
      detail: `status=${resp.status()} body=${JSON.stringify(parsed).slice(0,200)}`,
    });
  }

  // Scenario D: toggle OFF, seed another, verify block returns
  {
    setAllowSelfApproval(false);
    const title2 = "Audit: self-approval off test re-off";
    const id2 = seedApproval(title2);
    const r = await openDetailAndSnap(id2, "02d-flag-off-again", title2);
    log({
      phase,
      step: "toggle OFF again: block returns",
      status: r.sheetOpened && r.seesBlockCopy && r.approveBtn === 0 ? "pass" : "fail",
      detail: `sheet=${r.sheetOpened} blockCopyVisible=${r.seesBlockCopy} approveBtns=${r.approveBtn}`,
      screenshot: r.shot,
    });
  }

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
