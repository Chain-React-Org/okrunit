// Audit 4: CRUD smoke on flows, templates, rules, teams, delegations,
// custom-roles, saved-filters, bulk-rules. List + basic create (where the
// resource supports fresh creation) + cleanup.

import { openBrowser, log, BASE } from "./harness";

type Probe = {
  label: string;
  list: { method: "GET"; path: string };
  // Optional: create + ensure we clean up
  create?: {
    path: string;
    body: any;
    idPath?: string[]; // nav path into response
    extractId?: (body: any) => string | undefined;
    cleanupPath?: (id: string) => string;
  };
};

async function main() {
  const phase = "Audit 4 (CRUD)";
  const { browser, context, page } = await openBrowser();
  const cookies = await context.cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const H = { "Content-Type": "application/json", Cookie: cookieHeader };

  const probes: Probe[] = [
    { label: "connections list", list: { method: "GET", path: "/api/v1/connections" } },
    { label: "flows list", list: { method: "GET", path: "/api/v1/flows" } },
    {
      label: "templates",
      list: { method: "GET", path: "/api/v1/templates" },
      create: {
        path: "/api/v1/templates",
        body: {
          name: "Audit template",
          title_template: "Audit {{action}}",
          description_template: "Seeded",
          priority: "medium",
          action_type: "audit.template",
        },
        extractId: (b) => b?.data?.id ?? b?.id,
        cleanupPath: (id) => `/api/v1/templates/${id}`,
      },
    },
    {
      label: "rules",
      list: { method: "GET", path: "/api/v1/rules" },
      create: {
        path: "/api/v1/rules",
        body: {
          name: "Audit rule",
          is_active: false,
          conditions: { priority: "low" },
          action: "auto_approve",
        },
        extractId: (b) => b?.data?.id ?? b?.id,
        cleanupPath: (id) => `/api/v1/rules/${id}`,
      },
    },
    {
      label: "teams",
      list: { method: "GET", path: "/api/v1/teams" },
      create: {
        path: "/api/v1/teams",
        body: { name: "Audit team", description: "Seeded" },
        extractId: (b) => b?.data?.id ?? b?.id ?? b?.team?.id,
        cleanupPath: (id) => `/api/v1/teams/${id}`,
      },
    },
    { label: "delegations list", list: { method: "GET", path: "/api/v1/delegations" } },
    { label: "custom-roles list", list: { method: "GET", path: "/api/v1/custom-roles" } },
    { label: "saved-filters list", list: { method: "GET", path: "/api/v1/saved-filters" } },
    { label: "notifications activity", list: { method: "GET", path: "/api/v1/notifications/activity" } },
    { label: "oauth clients list", list: { method: "GET", path: "/api/v1/oauth/clients" } },
    { label: "messaging connections list", list: { method: "GET", path: "/api/v1/messaging/connections" } },
    { label: "analytics overview", list: { method: "GET", path: "/api/v1/analytics/overview" } },
    { label: "billing usage", list: { method: "GET", path: "/api/v1/billing/usage" } },
  ];

  for (const p of probes) {
    const resp = await page.request.fetch(`${BASE}${p.list.path}`, { method: p.list.method, headers: H });
    const bodyText = await resp.text();
    let parsed: any = null;
    try { parsed = JSON.parse(bodyText); } catch {}
    log({
      phase,
      step: `${p.list.method} ${p.list.path}`,
      status: resp.ok() ? "pass" : "fail",
      detail: `http=${resp.status()} shape=${Array.isArray(parsed?.data) ? "data[]" : Array.isArray(parsed) ? "array" : typeof parsed}`,
    });

    if (p.create && resp.ok()) {
      const cResp = await page.request.post(`${BASE}${p.create.path}`, { data: p.create.body, headers: H });
      const cBody = await cResp.json().catch(() => ({}));
      const id = p.create.extractId?.(cBody);
      log({
        phase,
        step: `POST ${p.create.path}`,
        status: cResp.ok() ? "pass" : "fail",
        detail: `http=${cResp.status()} id=${id ?? "none"}`,
      });
      if (id && p.create.cleanupPath) {
        const dResp = await page.request.delete(`${BASE}${p.create.cleanupPath(id)}`, { headers: H });
        log({
          phase,
          step: `DELETE ${p.create.cleanupPath(id)}`,
          status: dResp.ok() ? "pass" : "warn",
          detail: `http=${dResp.status()}`,
        });
      }
    }
  }

  await browser.close();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
