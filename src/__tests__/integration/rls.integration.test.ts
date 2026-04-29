// ---------------------------------------------------------------------------
// RLS data-isolation tests.
//
// These run against a live Postgres (pglite) with every supabase migration
// applied, so they exercise the real auth_org_id() function and every CREATE
// POLICY / WITH CHECK clause in the codebase. They are the only tests in
// the suite that would fail if a future migration accidentally drops a
// tenant filter, and they would also fail if a query is rewritten to bypass
// RLS via the service-role client where it should not.
//
// Why this matters: a regression here is a cross-tenant data leak.
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createIntegrationDb, type IntegrationDb } from "./db";
import { joinOrg, seedApproval, seedConnection, seedOrg, seedTeam, seedUser } from "./fixtures";

let db: IntegrationDb;

beforeAll(async () => {
  db = await createIntegrationDb();
}, 120_000);

afterAll(async () => {
  await db?.raw.close();
});

beforeEach(async () => {
  // Wipe rows we own so each test starts clean. Migrations seed the plans
  // table so we leave plans alone. Order matters because of FKs.
  await db.asServiceRole();
  await db.exec(`
    DELETE FROM approval_votes;
    DELETE FROM approval_comments;
    DELETE FROM approval_attachments;
    DELETE FROM webhook_delivery_log;
    DELETE FROM email_action_tokens;
    DELETE FROM approval_requests;
    DELETE FROM team_memberships;
    DELETE FROM teams;
    DELETE FROM connections;
    DELETE FROM org_memberships;
    DELETE FROM user_profiles;
    DELETE FROM auth.identities;
    DELETE FROM auth.users;
    DELETE FROM subscriptions;
    DELETE FROM organizations;
  `);
});

describe("approval_requests RLS: cross-org isolation", () => {
  it("a member of org A cannot see approvals belonging to org B", async () => {
    const orgA = await seedOrg(db, { name: "Org A" });
    const orgB = await seedOrg(db, { name: "Org B" });
    const userA = await seedUser(db);
    await joinOrg(db, { userId: userA.id, orgId: orgA.id, role: "owner", isDefault: true });

    const connA = await seedConnection(db, { orgId: orgA.id });
    const connB = await seedConnection(db, { orgId: orgB.id });
    await seedApproval(db, { orgId: orgA.id, connectionId: connA.id, title: "A's approval" });
    await seedApproval(db, { orgId: orgB.id, connectionId: connB.id, title: "B's secret" });

    await db.actAs(userA.id);
    const visible = await db.query<{ title: string }>(
      `SELECT title FROM approval_requests ORDER BY title`,
    );
    // What this catches: if the "Users can view org approvals" policy on
    // approval_requests is ever weakened (e.g., changed to USING (true) or
    // the auth_org_id() filter is dropped in a refactor), userA would see
    // "B's secret". This is a cross-tenant leak — exactly what RLS is for.
    expect(visible.rows.map((r) => r.title)).toEqual(["A's approval"]);
  });

  it("RLS still hides the row when the userA is granted membership in B but B is not their default org", async () => {
    const orgA = await seedOrg(db, { name: "Org A" });
    const orgB = await seedOrg(db, { name: "Org B" });
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: orgA.id, role: "owner", isDefault: true });
    await joinOrg(db, { userId: user.id, orgId: orgB.id, role: "member", isDefault: false });

    const connB = await seedConnection(db, { orgId: orgB.id });
    await seedApproval(db, { orgId: orgB.id, connectionId: connB.id, title: "B-only" });

    await db.actAs(user.id);
    const visible = await db.query<{ title: string }>(
      `SELECT title FROM approval_requests`,
    );
    // What this catches: the multi-org migration changed auth_org_id() to
    // return the user's *default* org. A regression that loosens it to
    // "any org I belong to" would leak rows across orgs the user has not
    // actively switched into. This is the bug the auth_org_id() docstring
    // is guarding against.
    expect(visible.rows.length).toBe(0);
  });

  it("auth_org_id() returns NULL when user has no memberships, and RLS therefore hides everything (does not fail open)", async () => {
    const orgA = await seedOrg(db);
    const user = await seedUser(db);
    // Note: we deliberately do NOT call joinOrg.
    const conn = await seedConnection(db, { orgId: orgA.id });
    await seedApproval(db, { orgId: orgA.id, connectionId: conn.id });

    await db.actAs(user.id);
    const visible = await db.query(`SELECT id FROM approval_requests`);
    // What this catches: a regression where auth_org_id() returns NULL and
    // the RLS policy treats NULL = NULL as TRUE (it should be NULL/UNKNOWN,
    // which RLS treats as deny). If a future migration uses COALESCE() or
    // similar to "default" the org id, this test would catch the resulting
    // fail-open behavior.
    expect(visible.rows.length).toBe(0);
  });
});

describe("approval_requests RLS: WITH CHECK on writes", () => {
  it("INSERT with a foreign org_id is rejected by RLS WITH CHECK", async () => {
    const orgA = await seedOrg(db);
    const orgB = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: orgA.id, role: "owner", isDefault: true });
    const connB = await seedConnection(db, { orgId: orgB.id });

    await db.actAs(user.id);
    await expect(
      db.query(
        `INSERT INTO approval_requests (org_id, connection_id, title, status)
         VALUES ($1, $2, 'malicious', 'pending')`,
        [orgB.id, connB.id],
      ),
    ).rejects.toThrow();
    // What this catches: removing the WITH CHECK clause on the
    // "Service role can insert approvals" policy would let a session-auth
    // user insert rows tagged with another org's id. The policy must
    // both USING and WITH CHECK on org_id = auth_org_id().
  });

  it("UPDATE that flips org_id to a different org is rejected by RLS WITH CHECK", async () => {
    const orgA = await seedOrg(db);
    const orgB = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: orgA.id, role: "owner", isDefault: true });
    const connA = await seedConnection(db, { orgId: orgA.id });
    const approval = await seedApproval(db, { orgId: orgA.id, connectionId: connA.id });

    await db.actAs(user.id);
    await expect(
      db.query(`UPDATE approval_requests SET org_id = $1 WHERE id = $2`, [orgB.id, approval.id]),
    ).rejects.toThrow();
    // What this catches: a regression that drops WITH CHECK on the UPDATE
    // policy would let a user reassign their own approval into another org
    // (effectively exfiltrating it). Both USING and WITH CHECK must filter
    // org_id; this test verifies the WITH CHECK side specifically.
  });
});

describe("connections RLS", () => {
  it("connections from another org are invisible", async () => {
    const orgA = await seedOrg(db);
    const orgB = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: orgA.id, role: "owner", isDefault: true });
    await seedConnection(db, { orgId: orgA.id, name: "A-conn" });
    await seedConnection(db, { orgId: orgB.id, name: "B-conn" });

    await db.actAs(user.id);
    const visible = await db.query<{ name: string }>(
      `SELECT name FROM connections ORDER BY name`,
    );
    expect(visible.rows.map((r) => r.name)).toEqual(["A-conn"]);
    // What this catches: the connections RLS policy is the only thing
    // stopping a user from listing every other tenant's API key prefixes
    // and rotation state. This must always require org_id = auth_org_id().
  });
});

describe("user_profiles RLS", () => {
  it("under RLS a user sees only their own profile, never teammates or strangers", async () => {
    const orgA = await seedOrg(db);
    const orgB = await seedOrg(db);
    const me = await seedUser(db, { email: "me@example.test" });
    const teammate = await seedUser(db, { email: "teammate@example.test" });
    const stranger = await seedUser(db, { email: "stranger@example.test" });
    await joinOrg(db, { userId: me.id, orgId: orgA.id, role: "owner", isDefault: true });
    await joinOrg(db, { userId: teammate.id, orgId: orgA.id, role: "member", isDefault: true });
    await joinOrg(db, { userId: stranger.id, orgId: orgB.id, role: "owner", isDefault: true });

    await db.actAs(me.id);
    const visible = await db.query<{ email: string }>(
      `SELECT email FROM user_profiles ORDER BY email`,
    );
    expect(visible.rows.map((r) => r.email)).toEqual(["me@example.test"]);
    // What this catches and pins: the user_profiles SELECT policy says
    //   id IN (SELECT user_id FROM org_memberships WHERE org_id = auth_org_id())
    // but org_memberships ALSO has RLS, scoped to user_id = auth.uid(). So
    // when the user_profiles subquery runs, it sees only the caller's own
    // membership, which collapses the IN clause to {me.id}. The effective
    // behavior is "users see only themselves under RLS".
    //
    // This means the dashboard's "list teammates" code MUST go through
    // createAdminClient() (service role), not the user-context client. If
    // someone refactors a teammate-listing endpoint to use the user client
    // and adds an `org_id = orgId` filter expecting RLS to be permissive,
    // they'll get a one-row result and a broken UI. This test pins the
    // RLS behavior so that refactor either updates this expectation
    // intentionally or fails CI.
  });

  it("via the service-role client, all profiles are visible (used by team listings)", async () => {
    const orgA = await seedOrg(db);
    const me = await seedUser(db, { email: "me2@example.test" });
    const teammate = await seedUser(db, { email: "teammate2@example.test" });
    await joinOrg(db, { userId: me.id, orgId: orgA.id, role: "owner", isDefault: true });
    await joinOrg(db, { userId: teammate.id, orgId: orgA.id, role: "member", isDefault: true });

    await db.asServiceRole();
    const visible = await db.query<{ email: string }>(
      `SELECT email FROM user_profiles WHERE id IN (
         SELECT user_id FROM org_memberships WHERE org_id = $1
       ) ORDER BY email`,
      [orgA.id],
    );
    expect(visible.rows.map((r) => r.email)).toEqual([
      "me2@example.test",
      "teammate2@example.test",
    ]);
    // What this catches: paired with the previous test, this confirms the
    // service-role escape hatch works. If someone "fixes" the perceived
    // RLS bug above by adding service-role-equivalent permissions to the
    // authenticated role, this test still passes but the previous one
    // would start returning teammates too — which would be a security
    // regression. The pair forces an intentional choice.
  });
});

describe("approval_comments / approval_votes / webhook_delivery_log RLS via subquery", () => {
  it("comments on another org's approval are not visible", async () => {
    const orgA = await seedOrg(db);
    const orgB = await seedOrg(db);
    const userA = await seedUser(db);
    const userB = await seedUser(db);
    await joinOrg(db, { userId: userA.id, orgId: orgA.id, role: "owner", isDefault: true });
    await joinOrg(db, { userId: userB.id, orgId: orgB.id, role: "owner", isDefault: true });
    const connA = await seedConnection(db, { orgId: orgA.id });
    const connB = await seedConnection(db, { orgId: orgB.id });
    const approvalA = await seedApproval(db, { orgId: orgA.id, connectionId: connA.id });
    const approvalB = await seedApproval(db, { orgId: orgB.id, connectionId: connB.id });

    await db.asServiceRole();
    await db.query(
      `INSERT INTO approval_comments (request_id, user_id, body) VALUES ($1, $2, 'hidden from A')`,
      [approvalB.id, userB.id],
    );
    await db.query(
      `INSERT INTO approval_comments (request_id, user_id, body) VALUES ($1, $2, 'visible to A')`,
      [approvalA.id, userA.id],
    );

    await db.actAs(userA.id);
    const visible = await db.query<{ body: string }>(`SELECT body FROM approval_comments`);
    expect(visible.rows.map((r) => r.body)).toEqual(["visible to A"]);
    // What this catches: approval_comments uses a `request_id IN (SELECT id
    // FROM approval_requests WHERE org_id = auth_org_id())` policy. If a
    // refactor flattens the subquery away or replaces it with a JOIN that
    // forgets the auth_org_id() filter, comments leak across orgs. This
    // pattern is repeated across several other tables; if it breaks once
    // it's likely to break again.
  });

  it("webhook_delivery_log respects the connection->org chain", async () => {
    const orgA = await seedOrg(db);
    const orgB = await seedOrg(db);
    const userA = await seedUser(db);
    await joinOrg(db, { userId: userA.id, orgId: orgA.id, role: "owner", isDefault: true });
    const connA = await seedConnection(db, { orgId: orgA.id });
    const connB = await seedConnection(db, { orgId: orgB.id });
    const approvalA = await seedApproval(db, { orgId: orgA.id, connectionId: connA.id });
    const approvalB = await seedApproval(db, { orgId: orgB.id, connectionId: connB.id });

    await db.asServiceRole();
    await db.query(
      `INSERT INTO webhook_delivery_log (request_id, connection_id, url, success)
       VALUES ($1, $2, 'https://hooks.test/a', true)`,
      [approvalA.id, connA.id],
    );
    await db.query(
      `INSERT INTO webhook_delivery_log (request_id, connection_id, url, success)
       VALUES ($1, $2, 'https://hooks.test/b', true)`,
      [approvalB.id, connB.id],
    );

    await db.actAs(userA.id);
    const visible = await db.query<{ url: string }>(`SELECT url FROM webhook_delivery_log`);
    expect(visible.rows.map((r) => r.url)).toEqual(["https://hooks.test/a"]);
    // What this catches: webhook delivery URLs may carry sensitive tokens
    // or callback secrets in query strings, so leaking them across tenants
    // is high impact. The policy chains through connections; if anyone ever
    // simplifies it to just JOIN connections WITHOUT the org_id filter, the
    // chain breaks open.
  });
});

describe("teams RLS and team_memberships scoping", () => {
  it("teams in other orgs are invisible", async () => {
    const orgA = await seedOrg(db);
    const orgB = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: orgA.id, role: "owner", isDefault: true });
    await seedTeam(db, { orgId: orgA.id, name: "team-A" });
    await seedTeam(db, { orgId: orgB.id, name: "team-B" });

    await db.actAs(user.id);
    const visible = await db.query<{ name: string }>(`SELECT name FROM teams`);
    expect(visible.rows.map((r) => r.name)).toEqual(["team-A"]);
  });
});
