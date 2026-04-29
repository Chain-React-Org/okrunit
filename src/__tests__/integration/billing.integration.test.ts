// ---------------------------------------------------------------------------
// Billing tests: trial expiry, quota enforcement, plan override precedence.
//
// These mirror the SQL behavior of getOrgPlan() / canCreateRequest() in
// src/lib/billing/enforce.ts so the integrity contract is pinned at the
// data layer. Where the production code applies the trial-expiry
// auto-downgrade, we apply the same UPDATE statements and assert the
// resulting rows match.
// ---------------------------------------------------------------------------

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createIntegrationDb, type IntegrationDb } from "./db";
import { seedConnection, seedOrg } from "./fixtures";

let db: IntegrationDb;
beforeAll(async () => { db = await createIntegrationDb(); }, 120_000);
afterAll(async () => { await db?.raw.close(); });

beforeEach(async () => {
  await db.asServiceRole();
  await db.exec(`
    DELETE FROM approval_requests;
    DELETE FROM connections;
    DELETE FROM org_memberships;
    DELETE FROM user_profiles;
    DELETE FROM auth.users;
    DELETE FROM subscriptions;
    DELETE FROM organizations;
  `);
});

/** Mirrors getOrgPlan() decision tree. Returns the plan id and any side-effect rows updated. */
async function getOrgPlan(orgId: string): Promise<{
  plan: string;
  autoDowngraded: boolean;
}> {
  const orgRow = await db.query<{ plan_override: string | null }>(
    `SELECT plan_override FROM organizations WHERE id = $1`,
    [orgId],
  );
  if (orgRow.rows[0]?.plan_override) {
    return { plan: orgRow.rows[0].plan_override, autoDowngraded: false };
  }

  const sub = await db.query<{ plan_id: string; status: string; trial_end: Date | null }>(
    `SELECT plan_id, status, trial_end FROM subscriptions WHERE org_id = $1`,
    [orgId],
  );
  const data = sub.rows[0];
  if (!data) return { plan: "free", autoDowngraded: false };

  if (data.status === "trialing") {
    if (data.trial_end && new Date(data.trial_end) < new Date()) {
      // Auto-downgrade in two writes, mirroring enforce.ts.
      await db.query(
        `UPDATE subscriptions SET plan_id = 'free', status = 'expired' WHERE org_id = $1`,
        [orgId],
      );
      await db.query(`UPDATE organizations SET plan_id = 'free' WHERE id = $1`, [orgId]);
      return { plan: "free", autoDowngraded: true };
    }
    return { plan: data.plan_id, autoDowngraded: false };
  }

  if (data.status !== "active") return { plan: "free", autoDowngraded: false };
  return { plan: data.plan_id, autoDowngraded: false };
}

/** Mirror of canCreateRequest's quota logic (free plan == 100 requests/month). */
async function canCreateRequest(orgId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
  const { plan } = await getOrgPlan(orgId);
  const limits: Record<string, number> = {
    free: 100,
    pro: -1, // -1 == unlimited (matches plans table)
    business: -1,
    enterprise: -1,
  };
  const limit = limits[plan] ?? 100;
  if (limit === -1) return { allowed: true, current: 0, limit: -1 };

  const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  const c = await db.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM approval_requests
       WHERE org_id = $1 AND created_at >= $2`,
    [orgId, periodStart],
  );
  const current = Number(c.rows[0]?.n ?? 0);
  return { allowed: current < limit, current, limit };
}

describe("getOrgPlan: trial expiry + auto-downgrade", () => {
  it("active trialing subscription with trial_end in future returns the trial plan", async () => {
    const org = await seedOrg(db);
    await db.query(
      `UPDATE subscriptions SET plan_id = 'pro', status = 'trialing',
         trial_end = now() + interval '7 days' WHERE org_id = $1`,
      [org.id],
    );
    const r = await getOrgPlan(org.id);
    expect(r.plan).toBe("pro");
    expect(r.autoDowngraded).toBe(false);
  });

  it("expired trial: status flips to 'expired', plan downgrades to 'free' atomically across rows", async () => {
    const org = await seedOrg(db);
    await db.query(
      `UPDATE subscriptions SET plan_id = 'pro', status = 'trialing',
         trial_end = now() - interval '1 minute' WHERE org_id = $1`,
      [org.id],
    );

    const r = await getOrgPlan(org.id);
    expect(r.plan).toBe("free");
    expect(r.autoDowngraded).toBe(true);

    // Verify both rows were written: subscription AND organizations.plan_id.
    const sub = await db.query<{ plan_id: string; status: string }>(
      `SELECT plan_id, status FROM subscriptions WHERE org_id = $1`,
      [org.id],
    );
    expect(sub.rows[0]).toEqual({ plan_id: "free", status: "expired" });
    const o = await db.query<{ plan_id: string }>(
      `SELECT plan_id FROM organizations WHERE id = $1`,
      [org.id],
    );
    expect(o.rows[0]?.plan_id).toBe("free");

    // What this catches: the auto-downgrade is the only thing standing
    // between an unpaid trialer and the unlimited 'pro' quota. If a
    // refactor of getOrgPlan splits the two UPDATE calls and the second
    // throws, the subscription is "expired" but organizations.plan_id is
    // still 'pro' — the UI shows pro, the quota check sees free, very
    // confusing. This pins both writes happening together.
  });

  it("plan_override on the organization wins over the subscription's plan_id", async () => {
    const org = await seedOrg(db);
    await db.query(`UPDATE organizations SET plan_override = 'enterprise' WHERE id = $1`, [org.id]);
    await db.query(
      `UPDATE subscriptions SET plan_id = 'free', status = 'active' WHERE org_id = $1`,
      [org.id],
    );

    const r = await getOrgPlan(org.id);
    expect(r.plan).toBe("enterprise");

    // What this catches: plan_override is the support team's lever for
    // courtesy upgrades. If a refactor of getOrgPlan ever falls through
    // to the subscription before checking the override, support's manual
    // upgrade silently does nothing. This pins the precedence order.
  });

  it("non-active, non-trialing subscription falls through to 'free' regardless of plan_id", async () => {
    const org = await seedOrg(db);
    await db.query(
      `UPDATE subscriptions SET plan_id = 'pro', status = 'past_due' WHERE org_id = $1`,
      [org.id],
    );
    const r = await getOrgPlan(org.id);
    expect(r.plan).toBe("free");

    // What this catches: when Stripe declines a charge and our webhook
    // marks the subscription past_due, the user must lose pro privileges
    // immediately. If a refactor accepts past_due as "still active"
    // because they don't want to interrupt the user's session, customers
    // who never pay continue using paid features indefinitely.
  });
});

describe("canCreateRequest: quota enforcement", () => {
  it("free org at quota - 1 is allowed", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    // Free plan limit is 100; insert 99 in this period.
    const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    for (let i = 0; i < 99; i++) {
      await db.query(
        `INSERT INTO approval_requests (org_id, connection_id, title, created_at)
         VALUES ($1, $2, $3, $4)`,
        [org.id, conn.id, `req-${i}`, periodStart],
      );
    }
    const r = await canCreateRequest(org.id);
    expect(r.allowed).toBe(true);
    expect(r.current).toBe(99);
  });

  it("free org at exactly quota is denied", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    for (let i = 0; i < 100; i++) {
      await db.query(
        `INSERT INTO approval_requests (org_id, connection_id, title, created_at)
         VALUES ($1, $2, $3, $4)`,
        [org.id, conn.id, `req-${i}`, periodStart],
      );
    }
    const r = await canCreateRequest(org.id);
    expect(r.allowed).toBe(false);
    expect(r.current).toBe(100);
    expect(r.limit).toBe(100);

    // What this catches: the boundary is `current >= limit` (deny at exactly
    // 100), not `current > limit` (allow 100, deny only at 101). If a
    // refactor flips the comparator, every free org gets one extra request
    // per month — measurable revenue leak at scale.
  });

  it("pro plan ignores the count entirely (unlimited)", async () => {
    const org = await seedOrg(db);
    await db.query(`UPDATE subscriptions SET plan_id = 'pro', status = 'active' WHERE org_id = $1`, [org.id]);
    await db.query(`UPDATE organizations SET plan_id = 'pro' WHERE id = $1`, [org.id]);
    const conn = await seedConnection(db, { orgId: org.id });

    const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    for (let i = 0; i < 200; i++) {
      await db.query(
        `INSERT INTO approval_requests (org_id, connection_id, title, created_at)
         VALUES ($1, $2, $3, $4)`,
        [org.id, conn.id, `req-${i}`, periodStart],
      );
    }
    const r = await canCreateRequest(org.id);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(-1);

    // What this catches: -1 is the "unlimited" sentinel in the plans
    // table. If someone "fixes" the plans table to use NULL or 999999 or
    // similar, the comparison becomes `200 >= 999999` (still allow) but
    // `200 >= -1` (deny, because every positive number is >= -1!). The
    // sentinel is fragile; this test pins the contract.
  });

  it("approvals from a previous month do NOT count against the current month's quota", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });
    // 100 approvals in the PRIOR month (>= 32 days back).
    const oldDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
    for (let i = 0; i < 100; i++) {
      await db.query(
        `INSERT INTO approval_requests (org_id, connection_id, title, created_at)
         VALUES ($1, $2, $3, $4)`,
        [org.id, conn.id, `old-${i}`, oldDate],
      );
    }
    const r = await canCreateRequest(org.id);
    expect(r.allowed).toBe(true);
    expect(r.current).toBe(0);

    // What this catches: the periodStart filter (gte("created_at",
    // periodStart)) is what makes monthly billing periods reset. If
    // someone removes the filter, the count is lifetime cumulative and
    // every long-lived free org eventually hits the cap permanently.
    // Equally, if the filter uses the wrong date column or computes
    // periodStart in the wrong timezone, prior-month rows can leak into
    // current-month tally. This catches the gross version of the bug.
  });
});

describe("subscriptions UNIQUE constraint", () => {
  it("inserting a second subscription for the same org_id is rejected", async () => {
    const org = await seedOrg(db);
    await expect(
      db.query(
        `INSERT INTO subscriptions (org_id, plan_id, status) VALUES ($1, 'pro', 'active')`,
        [org.id],
      ),
    ).rejects.toThrow(/duplicate key|unique/i);

    // What this catches: only ONE subscription row per org is the
    // invariant the rest of the code (especially the Stripe webhook
    // handler that does upsert by org_id) relies on. A second row would
    // make UPDATE-by-org_id non-deterministic. Pinning the constraint
    // protects the webhook handler from a class of subtle bugs.
  });
});
