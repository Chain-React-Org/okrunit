// Audit 5: Core approval API. Exercises POST /api/v1/approvals,
// GET single, GET list, PATCH decide, DELETE cancel, comments, rejection.
// Uses the logged-in user's session for session-auth endpoints; creates an
// API key for api_key-auth endpoints.

import { openBrowser, log, BASE } from "./harness";
import * as fs from "fs";

async function main() {
  const phase = "Audit 5 (approval API)";
  const { browser, context, page } = await openBrowser();
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const H = { "Content-Type": "application/json", Cookie: cookieHeader };

  // 1. Create an API key so we can exercise api_key auth paths
  let apiKey = "";
  {
    const resp = await page.request.post(`${BASE}/api/v1/connections`, {
      data: { name: "audit-key", action_types: [], scoping_rules: {} },
      headers: H,
    });
    const body = await resp.json();
    apiKey = body.api_key || body.key || "";
    log({
      phase,
      step: "POST /api/v1/connections (create key)",
      status: resp.ok() && apiKey ? "pass" : "fail",
      detail: `http=${resp.status()} hasKey=${!!apiKey}`,
    });
  }
  if (!apiKey) { await browser.close(); return; }

  const API_H = { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` };

  // 2. Create via API key
  let createdId = "";
  {
    const resp = await page.request.post(`${BASE}/api/v1/approvals`, {
      data: {
        title: "Audit: create-via-api-key",
        description: "Created by audit 05",
        priority: "medium",
        action_type: "audit.test",
      },
      headers: API_H,
    });
    const body = await resp.json();
    createdId = body.id ?? body.data?.id ?? "";
    log({
      phase,
      step: "POST /api/v1/approvals (api key)",
      status: resp.ok() && createdId ? "pass" : "fail",
      detail: `http=${resp.status()} id=${createdId}`,
    });
  }
  if (!createdId) { await browser.close(); return; }

  // 3. GET single via api key
  {
    const resp = await page.request.get(`${BASE}/api/v1/approvals/${createdId}`, { headers: API_H });
    const body = await resp.json();
    log({
      phase,
      step: "GET /api/v1/approvals/:id (api key)",
      status: resp.ok() && body.id === createdId ? "pass" : "fail",
      detail: `http=${resp.status()} status=${body.status}`,
    });
  }

  // 4. GET list via api key
  {
    const resp = await page.request.get(`${BASE}/api/v1/approvals?page_size=5`, { headers: API_H });
    const body = await resp.json();
    log({
      phase,
      step: "GET /api/v1/approvals (api key)",
      status: resp.ok() && Array.isArray(body.data) ? "pass" : "fail",
      detail: `http=${resp.status()} count=${body.data?.length ?? body.count}`,
    });
  }

  // 5. POST comment via session
  {
    const resp = await page.request.post(`${BASE}/api/v1/approvals/${createdId}/comments`, {
      data: { body: "audit comment" },
      headers: H,
    });
    log({
      phase,
      step: "POST /api/v1/approvals/:id/comments",
      status: resp.ok() ? "pass" : "fail",
      detail: `http=${resp.status()}`,
    });
  }

  // 6. PATCH decide via session (creator decides via API key, session-auth decides)
  //    Our user is the creator indirectly (api_key.created_by = userId). Since
  //    allow_self_approval is false right now, this should 403 with
  //    SELF_APPROVAL_BLOCKED.
  {
    const resp = await page.request.patch(`${BASE}/api/v1/approvals/${createdId}`, {
      data: { decision: "approve", comment: "audit approve" },
      headers: H,
    });
    const body = await resp.json().catch(() => ({}));
    // We expect SELF_APPROVAL_BLOCKED because we created it via api_key
    // (whose created_by = current user) and allow_self_approval is off.
    log({
      phase,
      step: "PATCH decide as creator (flag off) → expect block",
      status: resp.status() === 403 && body.code === "SELF_APPROVAL_BLOCKED" ? "pass" : "warn",
      detail: `http=${resp.status()} code=${body.code}`,
    });
  }

  // 7. Flip flag on → approve
  {
    await page.request.patch(`${BASE}/api/v1/org`, {
      data: { allow_self_approval: true },
      headers: H,
    });
    const resp = await page.request.patch(`${BASE}/api/v1/approvals/${createdId}`, {
      data: { decision: "approve", comment: "audit approve" },
      headers: H,
    });
    const body = await resp.json().catch(() => ({}));
    log({
      phase,
      step: "PATCH decide as creator (flag on)",
      status: resp.ok() && body.status === "approved" ? "pass" : "fail",
      detail: `http=${resp.status()} status=${body.status}`,
    });
    // Reset
    await page.request.patch(`${BASE}/api/v1/org`, {
      data: { allow_self_approval: false },
      headers: H,
    });
  }

  // 8. Create another request and DELETE (cancel)
  let cancelId = "";
  {
    const createResp = await page.request.post(`${BASE}/api/v1/approvals`, {
      data: { title: "Audit: will-cancel", priority: "low" },
      headers: API_H,
    });
    const createBody = await createResp.json();
    cancelId = createBody.id ?? "";
    const delResp = await page.request.delete(`${BASE}/api/v1/approvals/${cancelId}`, { headers: H });
    log({
      phase,
      step: "DELETE /api/v1/approvals/:id (cancel)",
      status: delResp.ok() ? "pass" : "fail",
      detail: `createHttp=${createResp.status()} delHttp=${delResp.status()}`,
    });
  }

  // 9. Rejection flow
  {
    const createResp = await page.request.post(`${BASE}/api/v1/approvals`, {
      data: { title: "Audit: will-reject", priority: "low" },
      headers: API_H,
    });
    const rid = (await createResp.json()).id;
    await page.request.patch(`${BASE}/api/v1/org`, {
      data: { allow_self_approval: true },
      headers: H,
    });
    const rejResp = await page.request.patch(`${BASE}/api/v1/approvals/${rid}`, {
      data: { decision: "reject", comment: "audit rejection reason" },
      headers: H,
    });
    const rejBody = await rejResp.json().catch(() => ({}));
    log({
      phase,
      step: "PATCH decide=reject",
      status: rejResp.ok() && rejBody.status === "rejected" ? "pass" : "fail",
      detail: `http=${rejResp.status()} status=${rejBody.status}`,
    });
    // Reset
    await page.request.patch(`${BASE}/api/v1/org`, {
      data: { allow_self_approval: false },
      headers: H,
    });
  }

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
