// Audit 7: Admin-style surfaces that an owner sees: audit log, invites,
// delegations, members, teams. Verify list API works and the pages render.

import { openBrowser, log, snap, BASE } from "./harness";

async function main() {
  const phase = "Audit 7 (admin surfaces)";
  const { browser, context, page } = await openBrowser();
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const H = { "Content-Type": "application/json", Cookie: cookieHeader };

  // --- Org members list ---
  {
    const resp = await page.request.get(`${BASE}/api/v1/team/members`, { headers: H });
    const body = await resp.json().catch(() => ({}));
    log({
      phase,
      step: "GET /api/v1/team/members",
      status: resp.ok() && Array.isArray(body.data) ? "pass" : "fail",
      detail: `http=${resp.status()} count=${body.data?.length}`,
    });
  }

  // --- Org invites: create + list ---
  let inviteId = "";
  {
    const create = await page.request.post(`${BASE}/api/v1/team/invite`, {
      data: { email: "audit-invitee@example.test", role: "approver", can_approve: true },
      headers: H,
    });
    const body = await create.json().catch(() => ({}));
    inviteId = body.data?.id ?? body.id ?? "";
    log({
      phase,
      step: "POST /api/v1/team/invite",
      status: create.ok() ? "pass" : "fail",
      detail: `http=${create.status()} id=${inviteId}`,
    });
  }

  // --- Delegations: list + create + delete ---
  // A delegation from self to self would fail validation; skip create for now
  // and just verify list works.
  {
    const resp = await page.request.get(`${BASE}/api/v1/delegations`, { headers: H });
    const body = await resp.json();
    log({
      phase,
      step: "GET /api/v1/delegations",
      status: resp.ok() ? "pass" : "fail",
      detail: `http=${resp.status()} count=${body.data?.length ?? 0}`,
    });
  }

  // --- Teams: create, add self, list members, delete ---
  let teamId = "";
  {
    const create = await page.request.post(`${BASE}/api/v1/teams`, {
      data: { name: "Audit team 07", description: "seeded" },
      headers: H,
    });
    const body = await create.json();
    teamId = body.data?.id ?? body.id ?? "";
    log({
      phase,
      step: "POST /api/v1/teams",
      status: create.ok() && teamId ? "pass" : "fail",
      detail: `http=${create.status()} id=${teamId}`,
    });
  }
  if (teamId) {
    const listMembers = await page.request.get(`${BASE}/api/v1/teams/${teamId}/members`, { headers: H });
    const body = await listMembers.json();
    log({
      phase,
      step: `GET teams/${teamId}/members`,
      status: listMembers.ok() ? "pass" : "fail",
      detail: `http=${listMembers.status()} count=${body.data?.length ?? 0}`,
    });
    const del = await page.request.delete(`${BASE}/api/v1/teams/${teamId}`, { headers: H });
    log({
      phase,
      step: `DELETE teams/${teamId}`,
      status: del.ok() ? "pass" : "warn",
      detail: `http=${del.status()}`,
    });
  }

  // --- Page renders ---
  const pages = [
    "/requests/audit-log",
    "/org/members",
    "/org/invites",
    "/org/teams",
    "/settings/delegation",
  ];
  for (const p of pages) {
    const r = await page.goto(`${BASE}${p}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const shot = await snap(page, `07${p.replace(/\//g, "_")}`);
    log({
      phase,
      step: `page ${p}`,
      status: r && r.status() === 200 ? "pass" : "fail",
      detail: `http=${r?.status()}`,
      screenshot: shot,
    });
  }

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
