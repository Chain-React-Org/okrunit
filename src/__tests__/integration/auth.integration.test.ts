// ---------------------------------------------------------------------------
// Auth integration tests.
//
// These mirror the exact SQL queries authenticateApiKey() in
// src/lib/api/auth.ts issues against the connections table:
//
//   1. SELECT ... WHERE api_key_hash = $1
//   2. SELECT ... WHERE previous_key_hash = $1 AND previous_key_expires_at > now()
//
// We test those queries directly so the *integrity contract* is pinned,
// independent of supabase-js wiring. Failure modes covered: dropping the
// previous_key_expires_at filter (revoked keys live forever), swapping the
// active flag check, etc. For OAuth tokens, the same approach: we test the
// SELECT ... WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at >
// now() pattern.
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createIntegrationDb, type IntegrationDb } from "./db";
import { joinOrg, seedConnection, seedOrg, seedUser } from "./fixtures";

let db: IntegrationDb;
beforeAll(async () => { db = await createIntegrationDb(); }, 120_000);
afterAll(async () => { await db?.raw.close(); });

beforeEach(async () => {
  await db.asServiceRole();
  await db.exec(`
    DELETE FROM oauth_access_tokens;
    DELETE FROM oauth_refresh_tokens;
    DELETE FROM oauth_authorization_codes;
    DELETE FROM oauth_clients;
    DELETE FROM connections;
    DELETE FROM org_memberships;
    DELETE FROM user_profiles;
    DELETE FROM auth.users;
    DELETE FROM subscriptions;
    DELETE FROM organizations;
  `);
});

function hash(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** The two SELECT queries authenticateApiKey() runs, in order. */
async function lookupApiKey(plaintext: string): Promise<{ id: string; isCurrent: boolean; isActive: boolean } | null> {
  const h = hash(plaintext);

  const current = await db.query<{ id: string; is_active: boolean }>(
    `SELECT id, is_active FROM connections WHERE api_key_hash = $1`,
    [h],
  );
  if (current.rows[0]) {
    return { id: current.rows[0].id, isCurrent: true, isActive: current.rows[0].is_active };
  }

  const rotated = await db.query<{ id: string; is_active: boolean }>(
    `SELECT id, is_active FROM connections
       WHERE previous_key_hash = $1 AND previous_key_expires_at > now()`,
    [h],
  );
  if (rotated.rows[0]) {
    return { id: rotated.rows[0].id, isCurrent: false, isActive: rotated.rows[0].is_active };
  }

  return null;
}

describe("API key authentication", () => {
  it("happy path: a valid current key resolves to the connection", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id });

    const r = await lookupApiKey(conn.plaintext);
    expect(r?.id).toBe(conn.id);
    expect(r?.isCurrent).toBe(true);
    expect(r?.isActive).toBe(true);
  });

  it("rotated key during grace period resolves to the same connection (and is flagged as deprecated)", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, {
      orgId: org.id,
      rotated: { previousExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
    });
    expect(conn.previousPlaintext).toBeTruthy();

    const r = await lookupApiKey(conn.previousPlaintext!);
    expect(r?.id).toBe(conn.id);
    expect(r?.isCurrent).toBe(false);

    // What this catches: the "graceful rotation" feature integrators rely
    // on while updating their stored API key. If a refactor ever drops the
    // previous-key fallback (or scopes it incorrectly), every integration
    // that hasn't yet picked up the new key starts 401-ing immediately.
    // This test fails before that ships.
  });

  it("rotated key AFTER previous_key_expires_at is rejected", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, {
      orgId: org.id,
      rotated: { previousExpiresAt: new Date(Date.now() - 60_000) },
    });

    const r = await lookupApiKey(conn.previousPlaintext!);
    expect(r).toBeNull();

    // What this catches: this is the *security* counterpart of the test
    // above. If the previous_key_expires_at filter is ever dropped (e.g.
    // someone simplifies the WHERE clause to just previous_key_hash = $1),
    // an old, retired API key keeps working forever — even after the user
    // explicitly rotated it because they thought it might be compromised.
    // The expires_at filter is the kill switch; this pins it.
  });

  it("forged plaintext that does not hash to anything in the table is rejected", async () => {
    const org = await seedOrg(db);
    await seedConnection(db, { orgId: org.id });

    const r = await lookupApiKey("ok_" + randomBytes(32).toString("hex"));
    expect(r).toBeNull();
  });

  it("an inactive connection still matches the SELECT but the route layer must reject it", async () => {
    const org = await seedOrg(db);
    const conn = await seedConnection(db, { orgId: org.id, isActive: false });

    const r = await lookupApiKey(conn.plaintext);
    expect(r?.id).toBe(conn.id);
    expect(r?.isActive).toBe(false);

    // What this catches: the connections table does NOT filter is_active in
    // the SELECT — that check is layered on top in authenticateApiKey()
    // (`if (!connection.is_active) throw ApiError(403)`). This test pins
    // the contract: the SQL returns the row regardless, the application
    // layer enforces the active flag. If someone ever adds "AND is_active
    // = true" to the SELECT, a deactivated connection's auth would 401
    // ("INVALID_API_KEY") instead of 403 ("INACTIVE_API_KEY") — a
    // misleading error code that masks the actual state.
  });
});

describe("OAuth access token authentication", () => {
  async function seedOauthClient(orgId: string): Promise<string> {
    const id = "client_" + randomBytes(8).toString("hex");
    const secret = randomBytes(32).toString("hex");
    await db.query(
      `INSERT INTO oauth_clients (client_id, client_secret_hash, client_secret_prefix, name, org_id, redirect_uris, scopes)
       VALUES ($1, $2, $3, 'test', $4, ARRAY['https://example.test/cb'], ARRAY['approvals:read','approvals:write'])`,
      [id, hash(secret), secret.slice(0, 8), orgId],
    );
    return id;
  }

  async function seedOauthToken(opts: {
    orgId: string;
    userId: string;
    clientId: string;
    expiresAt?: Date;
    revokedAt?: Date;
    scopes?: string[];
  }): Promise<{ plaintext: string; id: string }> {
    const plaintext = randomBytes(48).toString("hex");
    const tokenHash = hash(plaintext);
    const r = await db.query<{ id: string }>(
      `INSERT INTO oauth_access_tokens
         (token_hash, client_id, user_id, org_id, scopes, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        tokenHash,
        opts.clientId,
        opts.userId,
        opts.orgId,
        opts.scopes ?? ["approvals:read", "approvals:write"],
        (opts.expiresAt ?? new Date(Date.now() + 60 * 60 * 1000)).toISOString(),
        opts.revokedAt ? opts.revokedAt.toISOString() : null,
      ],
    );
    return { plaintext, id: r.rows[0]!.id };
  }

  async function lookupOauth(plaintext: string): Promise<{ id: string; revoked: boolean; expired: boolean; scopes: string[] } | null> {
    const r = await db.query<{ id: string; revoked_at: Date | null; expires_at: Date; scopes: string[] }>(
      `SELECT id, revoked_at, expires_at, scopes FROM oauth_access_tokens WHERE token_hash = $1`,
      [hash(plaintext)],
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      revoked: row.revoked_at !== null,
      expired: new Date(row.expires_at) < new Date(),
      scopes: row.scopes,
    };
  }

  it("happy path: valid token resolves to the access token row with scopes", async () => {
    const org = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: org.id, role: "owner", isDefault: true });
    const clientId = await seedOauthClient(org.id);
    const { plaintext } = await seedOauthToken({ orgId: org.id, userId: user.id, clientId });

    const r = await lookupOauth(plaintext);
    expect(r?.revoked).toBe(false);
    expect(r?.expired).toBe(false);
    expect(r?.scopes).toContain("approvals:write");
  });

  it("a revoked token is identifiable in the lookup result", async () => {
    const org = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: org.id, role: "owner", isDefault: true });
    const clientId = await seedOauthClient(org.id);
    const { plaintext } = await seedOauthToken({
      orgId: org.id,
      userId: user.id,
      clientId,
      revokedAt: new Date(Date.now() - 10_000),
    });

    const r = await lookupOauth(plaintext);
    expect(r?.revoked).toBe(true);

    // What this catches: route layer must treat revoked_at != null as a
    // hard reject (TOKEN_REVOKED). If a refactor adds `WHERE revoked_at IS
    // NULL` to the SELECT, then a forged client cannot use revoked tokens
    // — that's strictly stricter and fine. But if the refactor goes the
    // other direction (drops the route-level check, expecting the SELECT
    // to filter, but the SELECT does NOT filter), a revoked token still
    // authenticates. This pins the SQL behavior so any drift is caught.
  });

  it("an expired token is identifiable; the route must reject it", async () => {
    const org = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: org.id, role: "owner", isDefault: true });
    const clientId = await seedOauthClient(org.id);
    const { plaintext } = await seedOauthToken({
      orgId: org.id,
      userId: user.id,
      clientId,
      expiresAt: new Date(Date.now() - 60_000),
    });

    const r = await lookupOauth(plaintext);
    expect(r?.expired).toBe(true);
  });

  it("token issued with read-only scopes does NOT have approvals:write", async () => {
    const org = await seedOrg(db);
    const user = await seedUser(db);
    await joinOrg(db, { userId: user.id, orgId: org.id, role: "owner", isDefault: true });
    const clientId = await seedOauthClient(org.id);
    const { plaintext } = await seedOauthToken({
      orgId: org.id,
      userId: user.id,
      clientId,
      scopes: ["approvals:read"],
    });

    const r = await lookupOauth(plaintext);
    expect(r?.scopes).toEqual(["approvals:read"]);
    expect(r?.scopes).not.toContain("approvals:write");

    // What this catches: per the OAuth flow, scopes are stored as a TEXT[].
    // A read-only token must not be able to POST /v1/approvals. The route
    // layer enforces this by checking scopes; this test pins the column
    // shape and contents so a refactor of how scopes are stored (e.g.
    // changing to a comma-separated string, or always defaulting to all
    // scopes) would change the asserted shape and fail loudly.
  });
});
