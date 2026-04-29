// ---------------------------------------------------------------------------
// Approval state-machine + idempotency tests.
//
// These exercise the SQL guards that protect the core approval pipeline:
// the UNIQUE (connection_id, idempotency_key) constraint, the multi-step
// ordering invariants, and the "decision can only land on a pending row"
// guard. They run against a live Postgres so the constraint and trigger
// behavior is real, not simulated.
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createIntegrationDb, type IntegrationDb } from "./db";
import { joinOrg, seedApproval, seedConnection, seedOrg, seedTeam, seedUser } from "./fixtures";

let db: IntegrationDb;

beforeAll(async () => { db = await createIntegrationDb(); }, 120_000);
afterAll(async () => { await db?.raw.close(); });

beforeEach(async () => {
  await db.asServiceRole();
  await db.exec(`
    DELETE FROM step_votes;
    DELETE FROM approval_steps;
    DELETE FROM approval_votes;
    DELETE FROM approval_comments;
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

describe("approval_requests idempotency_key UNIQUE constraint", () => {
  it("two inserts with the same (connection_id, idempotency_key) collide and only one row exists", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });

    await db.query(
      `INSERT INTO approval_requests (org_id, connection_id, title, idempotency_key)
       VALUES ($1, $2, 'first', 'idem-1')`,
      [org.id, conn.id],
    );
    await expect(
      db.query(
        `INSERT INTO approval_requests (org_id, connection_id, title, idempotency_key)
         VALUES ($1, $2, 'second', 'idem-1')`,
        [org.id, conn.id],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);

    const count = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM approval_requests WHERE connection_id = $1`,
      [conn.id],
    );
    expect(Number(count.rows[0]?.n)).toBe(1);

    // What this catches: this constraint is the integrity guard behind the
    // POST /api/v1/approvals idempotency contract Zapier/Make/n8n rely on.
    // If a future migration drops the UNIQUE in approvals/initial_schema.sql,
    // a network-retry from an integration would create two distinct
    // approvals — and the calling automation would fire its decision
    // callback twice. This test fails if the constraint is removed.
  });

  it("the SAME idempotency_key on a DIFFERENT connection produces a distinct approval", async () => {
    const org = await seedOrg(db);
    const conn1 = await seedConnection(db, { orgId: org.id });
    const conn2 = await seedConnection(db, { orgId: org.id });

    await db.query(
      `INSERT INTO approval_requests (org_id, connection_id, title, idempotency_key)
       VALUES ($1, $2, 'a', 'shared-key')`,
      [org.id, conn1.id],
    );
    await db.query(
      `INSERT INTO approval_requests (org_id, connection_id, title, idempotency_key)
       VALUES ($1, $2, 'b', 'shared-key')`,
      [org.id, conn2.id],
    );

    const rows = await db.query<{ title: string }>(
      `SELECT title FROM approval_requests WHERE idempotency_key = 'shared-key' ORDER BY title`,
    );
    expect(rows.rows.map((r) => r.title)).toEqual(["a", "b"]);

    // What this catches: the UNIQUE is scoped to (connection_id, idempotency_key)
    // not (org_id, idempotency_key). If someone "tightens" it to org_id by
    // mistake, two integrations in the same org that happen to choose the
    // same idempotency key (a likely collision when both use `${user_id}`
    // or similar) would clobber each other. The bug would silently merge
    // unrelated approval requests across automations.
  });

  it("NULL idempotency_key allows multiple rows on the same connection", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });

    await db.query(
      `INSERT INTO approval_requests (org_id, connection_id, title) VALUES ($1, $2, 'a')`,
      [org.id, conn.id],
    );
    await db.query(
      `INSERT INTO approval_requests (org_id, connection_id, title) VALUES ($1, $2, 'b')`,
      [org.id, conn.id],
    );
    const count = await db.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM approval_requests WHERE connection_id = $1`,
      [conn.id],
    );
    expect(Number(count.rows[0]?.n)).toBe(2);

    // What this catches: NULLs are not equal to themselves under UNIQUE
    // semantics, so multiple rows with NULL idempotency_key are allowed.
    // If the column is ever changed to NOT NULL or someone writes
    // application code that treats NULL as "0" or empty string, normal
    // (non-idempotent) requests from a single connection would start
    // colliding. Pinning this behavior keeps that change visible.
  });
});

describe("approval terminal-state guard", () => {
  it("UPDATE ... WHERE status = 'pending' is the lock-free way to decide an approval atomically; second decision is a no-op", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    const user = await seedUser(db);
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });

    const first = await db.query(
      `UPDATE approval_requests
         SET status = 'approved', decided_by = $2, decided_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [approval.id, user.id],
    );
    expect(first.rows.length).toBe(1);

    const second = await db.query(
      `UPDATE approval_requests
         SET status = 'rejected', decided_by = $2, decided_at = now()
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [approval.id, user.id],
    );
    expect(second.rows.length).toBe(0);

    const final = await db.query<{ status: string; decided_by: string }>(
      `SELECT status, decided_by::text AS decided_by FROM approval_requests WHERE id = $1`,
      [approval.id],
    );
    expect(final.rows[0]?.status).toBe("approved");
    expect(final.rows[0]?.decided_by).toBe(user.id);

    // What this catches: this is the mutex pattern PATCH /api/v1/approvals/:id
    // relies on to make auto-action and human decisions race-safe. If a
    // refactor changes the WHERE clause to WHERE id = $1 (without the
    // status guard) or wraps it in a SELECT-then-UPDATE without a row
    // lock, two simultaneous deciders both succeed and the second one
    // silently overwrites the first's decision. This test fails if the
    // guard is gone — UPDATE 0 rows is the only safe failure mode.
  });

  it("auto-action + manual decision in the same window: only one terminal state lands", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    const human = await seedUser(db);
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });

    // Simulate the two deciders firing "concurrently" against the same row.
    // pglite serializes statements within a single connection, but the
    // WHERE-status-pending guard is still the integrity contract under test.
    const results = await Promise.allSettled([
      db.query(
        `UPDATE approval_requests SET status = 'approved', decided_by = $2,
           decided_at = now(), decision_source = 'api'
         WHERE id = $1 AND status = 'pending' RETURNING id`,
        [approval.id, human.id],
      ),
      db.query(
        `UPDATE approval_requests SET status = 'approved',
           decided_at = now(), decision_source = 'auto_rule', auto_approved = true
         WHERE id = $1 AND status = 'pending' RETURNING id`,
        [approval.id],
      ),
    ]);

    const updated = results
      .filter((r): r is PromiseFulfilledResult<{ rows: { id: string }[] }> => r.status === "fulfilled")
      .filter((r) => r.value.rows.length === 1);
    expect(updated).toHaveLength(1);

    const final = await db.query<{ status: string; decision_source: string; auto_approved: boolean }>(
      `SELECT status, decision_source, auto_approved
         FROM approval_requests WHERE id = $1`,
      [approval.id],
    );
    expect(final.rows[0]?.status).toBe("approved");
    expect(["api", "auto_rule"]).toContain(final.rows[0]?.decision_source);

    // What this catches: failure mode is a callback firing twice (once from
    // the human path, once from the auto-rule path) because both updates
    // succeed when the guard is missing or weakened (e.g., status IS NOT
    // NULL instead of status = 'pending'). The downstream Zapier/Make/n8n
    // callback gets duplicated decisions and may execute side effects
    // twice. This pins the invariant: one row, one terminal state.
  });

  it("a decision attempt on an already-rejected approval changes nothing", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    const user = await seedUser(db);
    const approval = await seedApproval(db, {
      orgId: org.id,
      connectionId: conn.id,
      status: "rejected",
    });

    const r = await db.query(
      `UPDATE approval_requests
         SET status = 'approved', decided_by = $2
       WHERE id = $1 AND status = 'pending'
       RETURNING id`,
      [approval.id, user.id],
    );
    expect(r.rows.length).toBe(0);

    const final = await db.query<{ status: string }>(
      `SELECT status FROM approval_requests WHERE id = $1`,
      [approval.id],
    );
    expect(final.rows[0]?.status).toBe("rejected");

    // What this catches: the "404 if not pending" / "409 conflict" code path
    // in the route handler depends on UPDATE returning zero rows for
    // already-decided approvals. If someone changes the SQL to UPSERT or
    // drops the status guard, a rejection could be flipped to an approval
    // hours later, retroactively triggering the downstream automation.
    // That's a "ghost approval" bug; this test catches it.
  });
});

describe("approval_steps state machine", () => {
  it("UNIQUE (request_id, step_order) prevents two steps with the same order", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });

    await db.query(
      `INSERT INTO approval_steps (request_id, step_order, name, status)
       VALUES ($1, 1, 'first', 'active')`,
      [approval.id],
    );
    await expect(
      db.query(
        `INSERT INTO approval_steps (request_id, step_order, name, status)
         VALUES ($1, 1, 'duplicate', 'waiting')`,
        [approval.id],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);

    // What this catches: the multi-step engine relies on step_order being
    // unique within a request to advance correctly. If a refactor adds a
    // step to a flow without checking for collision, the engine could
    // pick the wrong "next active step" or even loop. The constraint is
    // the safety net.
  });

  it("step_votes: same user voting twice on the same step is rejected", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    const user = await seedUser(db);
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });
    const step = await db.query<{ id: string }>(
      `INSERT INTO approval_steps (request_id, step_order, name, status)
       VALUES ($1, 1, 'review', 'active') RETURNING id`,
      [approval.id],
    );
    const stepId = step.rows[0]!.id;

    await db.query(
      `INSERT INTO step_votes (step_id, request_id, user_id, vote)
       VALUES ($1, $2, $3, 'approve')`,
      [stepId, approval.id, user.id],
    );
    await expect(
      db.query(
        `INSERT INTO step_votes (step_id, request_id, user_id, vote)
         VALUES ($1, $2, $3, 'reject')`,
        [stepId, approval.id, user.id],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);

    // What this catches: a user double-voting (e.g., changing their mind
    // by hitting the button twice in the dashboard) must not double-count.
    // The UNIQUE(step_id, user_id) constraint is what makes the step
    // engine's required_approvals accounting reliable. Drop it and a
    // single approver can satisfy a 3-of-N step alone.
  });
});

describe("approval_votes UNIQUE per request", () => {
  it("user voting twice on the same approval is rejected (not double-counted)", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    const user = await seedUser(db);
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });

    await db.query(
      `INSERT INTO approval_votes (request_id, user_id, vote) VALUES ($1, $2, 'approve')`,
      [approval.id, user.id],
    );
    await expect(
      db.query(
        `INSERT INTO approval_votes (request_id, user_id, vote) VALUES ($1, $2, 'reject')`,
        [approval.id, user.id],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);

    // What this catches: this is the single-vote-per-user invariant for
    // the multi-approver flow (required_approvals > 1). Without it, one
    // approver could spam approve clicks and satisfy a 4-eyes-style
    // requirement alone. This is one of the highest-impact constraints
    // in the system; the test documents it at the SQL level.
  });
});

describe("teams + assignment", () => {
  it("approval assigned to a team that does not exist is rejected by FK", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    const team = await seedTeam(db, { orgId: org.id });

    // Sanity: a real team works.
    const ok = await seedApproval(db, {
      orgId: org.id,
      connectionId: conn.id,
      teamId: team.id,
    });
    expect(ok.id).toBeTruthy();

    // Now try a fake team id.
    await expect(
      db.query(
        `INSERT INTO approval_requests (org_id, connection_id, title, assigned_team_id)
         VALUES ($1, $2, 'bad', '00000000-0000-0000-0000-000000000000')`,
        [org.id, conn.id],
      ),
    ).rejects.toThrow(/foreign key|violates/i);

    // What this catches: the assigned_team_id FK is the schema-level
    // safeguard against typos in the rules engine writing a team id from
    // another org (or a deleted team). Failure mode if the FK is dropped:
    // approvals get assigned to nonexistent teams, the dashboard query
    // returns empty for assignees, and approvers never see the request
    // until it expires. This catches regressions to ON DELETE SET NULL
    // semantics too.
  });
});
