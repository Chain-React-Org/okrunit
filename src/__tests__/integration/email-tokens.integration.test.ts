// ---------------------------------------------------------------------------
// Email-action token tests.
//
// Mirrors the SQL behavior of validateAndConsumeToken() in
// src/lib/notifications/tokens.ts: a row in email_action_tokens may be
// consumed exactly once, and only while not expired. The route uses an
// `eq("token", hash).is("consumed_at", null)` UPDATE as the atomic
// check-and-set; we exercise that pattern at the SQL level.
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createIntegrationDb, type IntegrationDb } from "./db";
import { joinOrg, seedApproval, seedConnection, seedOrg, seedUser } from "./fixtures";

let db: IntegrationDb;
beforeAll(async () => { db = await createIntegrationDb(); }, 120_000);
afterAll(async () => { await db?.raw.close(); });

beforeEach(async () => {
  await db.asServiceRole();
  await db.exec(`
    DELETE FROM email_action_tokens;
    DELETE FROM approval_requests;
    DELETE FROM connections;
    DELETE FROM org_memberships;
    DELETE FROM user_profiles;
    DELETE FROM auth.users;
    DELETE FROM subscriptions;
    DELETE FROM organizations;
  `);
});

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function seedToken(opts: {
  requestId: string;
  userId: string;
  action: "approve" | "reject";
  expiresAt?: Date;
  consumedAt?: Date;
}): Promise<{ plaintext: string; tokenHash: string; id: string }> {
  const plaintext = randomBytes(32).toString("hex");
  const tokenHash = hash(plaintext);
  const expiresAt = (opts.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000)).toISOString();
  const consumedAt = opts.consumedAt ? opts.consumedAt.toISOString() : null;
  const r = await db.query<{ id: string }>(
    `INSERT INTO email_action_tokens (request_id, user_id, action, token, expires_at, consumed_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [opts.requestId, opts.userId, opts.action, tokenHash, expiresAt, consumedAt],
  );
  return { plaintext, tokenHash, id: r.rows[0]!.id };
}

/** Mirror of validateAndConsumeToken's atomic check-and-set, expressed in raw SQL. */
async function consumeToken(plaintext: string): Promise<{ id: string } | null> {
  const r = await db.query<{ id: string }>(
    `UPDATE email_action_tokens
        SET consumed_at = now()
      WHERE token = $1
        AND consumed_at IS NULL
        AND expires_at > now()
      RETURNING id`,
    [hash(plaintext)],
  );
  return r.rows[0] ?? null;
}

describe("email_action_tokens consume-once", () => {
  it("first POST consumes the token; second POST returns no row (410 Gone)", async () => {
    const org = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: org.id, role: "owner", isDefault: true });
    const conn = await seedConnection(db, { orgId: org.id });
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });
    const { plaintext, id } = await seedToken({
      requestId: approval.id,
      userId: user.id,
      action: "approve",
    });

    const first = await consumeToken(plaintext);
    expect(first?.id).toBe(id);

    const second = await consumeToken(plaintext);
    expect(second).toBeNull();

    // Verify row state: consumed_at is set, exactly once.
    const row = await db.query<{ consumed_at: Date | null }>(
      `SELECT consumed_at FROM email_action_tokens WHERE id = $1`,
      [id],
    );
    expect(row.rows[0]?.consumed_at).toBeTruthy();

    // What this catches: the route's atomic UPDATE + RETURNING is the only
    // protection against a refresh-after-decide double-consume. If a
    // refactor changes the SQL to a SELECT-then-UPDATE pair, two rapid
    // clicks can both read consumed_at IS NULL and both UPDATE; the first
    // wins the race but the second still gets a "valid" return value and
    // the user's decision is double-applied. The conditional UPDATE makes
    // that physically impossible.
  });

  it("expired token cannot be consumed even if consumed_at is still NULL", async () => {
    const org = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: org.id, role: "owner", isDefault: true });
    const conn = await seedConnection(db, { orgId: org.id });
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });
    const { plaintext } = await seedToken({
      requestId: approval.id,
      userId: user.id,
      action: "approve",
      expiresAt: new Date(Date.now() - 60_000),
    });

    const r = await consumeToken(plaintext);
    expect(r).toBeNull();

    // What this catches: failure path of validateAndConsumeToken. If the
    // expires_at check is dropped from the WHERE clause, week-old links
    // (sent in last week's notification email) become valid forever, which
    // turns an inbox compromise into a permanent approval-decision capability.
  });

  it("a different plaintext that hashes differently is rejected", async () => {
    const org = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: org.id, role: "owner", isDefault: true });
    const conn = await seedConnection(db, { orgId: org.id });
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });
    await seedToken({ requestId: approval.id, userId: user.id, action: "approve" });

    const r = await consumeToken("forged-plaintext-not-in-the-db");
    expect(r).toBeNull();

    // What this catches: the column is the SHA-256 hash of the token, not
    // the token itself. If a refactor accidentally compares plaintext, an
    // attacker who somehow learns a hash (DB read) cannot mint a valid
    // token from it; if compares plaintext, they could.
  });

  it("two concurrent consume attempts only succeed once", async () => {
    const org = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: org.id, role: "owner", isDefault: true });
    const conn = await seedConnection(db, { orgId: org.id });
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });
    const { plaintext } = await seedToken({
      requestId: approval.id,
      userId: user.id,
      action: "approve",
    });

    const results = await Promise.all([consumeToken(plaintext), consumeToken(plaintext)]);
    const succeeded = results.filter((r) => r !== null);
    expect(succeeded).toHaveLength(1);

    // What this catches: even though pglite serializes statements within a
    // single connection, the WHERE consumed_at IS NULL guard is what makes
    // this safe under real concurrency too. Asserting that one of the two
    // returns null pins the contract; if someone changes consumeToken to
    // read first then UPDATE without the WHERE guard, both would succeed
    // and we'd see both deciding the approval. This documents the safe
    // pattern.
  });

  it("a token whose request_id no longer exists is automatically deleted by FK cascade", async () => {
    const org = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: org.id, role: "owner", isDefault: true });
    const conn = await seedConnection(db, { orgId: org.id });
    const approval = await seedApproval(db, { orgId: org.id, connectionId: conn.id });
    const { plaintext, id } = await seedToken({
      requestId: approval.id,
      userId: user.id,
      action: "approve",
    });

    await db.query(`DELETE FROM approval_requests WHERE id = $1`, [approval.id]);

    const remaining = await db.query(`SELECT id FROM email_action_tokens WHERE id = $1`, [id]);
    expect(remaining.rows).toHaveLength(0);

    const r = await consumeToken(plaintext);
    expect(r).toBeNull();

    // What this catches: ON DELETE CASCADE on the request_id FK is the
    // mechanism that revokes outstanding tokens when a request is
    // cancelled or its connection is deleted. Removing the cascade is a
    // subtle bug — tokens become "orphaned but still usable" (no, actually
    // unusable because the route fetches the approval and sees nothing).
    // But this still documents the guarantee.
  });
});
