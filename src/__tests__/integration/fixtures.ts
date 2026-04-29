// ---------------------------------------------------------------------------
// Test fixtures: tiny seed helpers that write rows the integration tests
// reason about. Each helper takes the IntegrationDb in service-role mode
// (the default), so RLS is not in the way during setup. Tests opt into RLS
// by calling db.actAs(userId) before the queries they want to enforce.
// ---------------------------------------------------------------------------

import { randomUUID, randomBytes, createHash } from "crypto";
import type { IntegrationDb } from "./db";

export interface SeededOrg {
  id: string;
  name: string;
  planId: string;
}

export interface SeededUser {
  id: string;
  email: string;
}

export interface SeededMembership {
  userId: string;
  orgId: string;
  role: "owner" | "admin" | "member";
  isDefault: boolean;
  canApprove: boolean;
}

export interface SeededConnection {
  id: string;
  orgId: string;
  plaintext: string;
  hash: string;
  prefix: string;
  previousPlaintext?: string;
  previousHash?: string;
}

export interface SeededApproval {
  id: string;
  orgId: string;
  connectionId: string;
  status: string;
  idempotencyKey: string | null;
}

export interface SeededTeam {
  id: string;
  orgId: string;
  name: string;
}

export async function seedOrg(
  db: IntegrationDb,
  opts: { name?: string; planId?: "free" | "pro" | "business" | "enterprise" } = {},
): Promise<SeededOrg> {
  const id = randomUUID();
  const name = opts.name ?? `Org ${id.slice(0, 6)}`;
  const planId = opts.planId ?? "free";
  await db.query(
    `INSERT INTO organizations (id, name, plan_id) VALUES ($1, $2, $3)`,
    [id, name, planId],
  );
  // Migrations seed a free subscription for every org via INSERT ... ON
  // CONFLICT, but only for orgs present at migration time. We need to insert
  // one for newly-seeded orgs explicitly.
  await db.query(
    `INSERT INTO subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
     VALUES ($1, $2, 'active', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month')
     ON CONFLICT (org_id) DO NOTHING`,
    [id, planId],
  );
  return { id, name, planId };
}

export async function seedUser(
  db: IntegrationDb,
  opts: { email?: string; fullName?: string } = {},
): Promise<SeededUser> {
  const id = randomUUID();
  const email = opts.email ?? `user-${id.slice(0, 6)}@example.test`;
  await db.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at)
     VALUES ($1, $2, $3, now())`,
    [id, email, JSON.stringify({ full_name: opts.fullName ?? "" })],
  );
  // The handle_new_user trigger has likely auto-created an org + profile +
  // membership. We don't want that automatic org for tests because callers
  // explicitly join users to orgs they seed. Strip the trigger-created rows.
  await db.query(
    `DELETE FROM organizations WHERE id IN (
       SELECT org_id FROM org_memberships WHERE user_id = $1
     )`,
    [id],
  );
  await db.query(`DELETE FROM org_memberships WHERE user_id = $1`, [id]);
  await db.query(`DELETE FROM user_profiles WHERE id = $1`, [id]);
  // Re-insert just the user_profile (no org link in this column post-multi-org migration).
  await db.query(
    `INSERT INTO user_profiles (id, email, full_name) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO NOTHING`,
    [id, email, opts.fullName ?? ""],
  );
  return { id, email };
}

export async function joinOrg(
  db: IntegrationDb,
  args: {
    userId: string;
    orgId: string;
    role?: "owner" | "admin" | "member";
    isDefault?: boolean;
    canApprove?: boolean;
  },
): Promise<SeededMembership> {
  const role = args.role ?? "member";
  const isDefault = args.isDefault ?? false;
  const canApprove = args.canApprove ?? (role === "owner" || role === "admin");

  // org_memberships has a partial unique index: only one row per user can
  // have is_default=true. Demote any existing default first if we are about
  // to mark a new one default.
  if (isDefault) {
    await db.query(
      `UPDATE org_memberships SET is_default = false WHERE user_id = $1 AND is_default = true`,
      [args.userId],
    );
  }

  await db.query(
    `INSERT INTO org_memberships (user_id, org_id, role, is_default, can_approve)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, org_id) DO UPDATE
     SET role = EXCLUDED.role, is_default = EXCLUDED.is_default, can_approve = EXCLUDED.can_approve`,
    [args.userId, args.orgId, role, isDefault, canApprove],
  );

  return { userId: args.userId, orgId: args.orgId, role, isDefault, canApprove };
}

export async function seedConnection(
  db: IntegrationDb,
  opts: {
    orgId: string;
    name?: string;
    rotated?: { previousExpiresAt?: Date };
    isActive?: boolean;
  },
): Promise<SeededConnection> {
  const id = randomUUID();
  const plaintext = `ok_${randomBytes(32).toString("hex")}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  const prefix = plaintext.slice(3, 11);

  let previousPlaintext: string | undefined;
  let previousHash: string | null = null;
  let previousExpiresAt: string | null = null;
  if (opts.rotated) {
    previousPlaintext = `ok_${randomBytes(32).toString("hex")}`;
    previousHash = createHash("sha256").update(previousPlaintext).digest("hex");
    previousExpiresAt = (opts.rotated.previousExpiresAt ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).toISOString();
  }

  await db.query(
    `INSERT INTO connections (id, org_id, name, api_key_hash, api_key_prefix, is_active,
                              previous_key_hash, previous_key_expires_at, rotated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      opts.orgId,
      opts.name ?? `conn-${id.slice(0, 6)}`,
      hash,
      prefix,
      opts.isActive ?? true,
      previousHash,
      previousExpiresAt,
      opts.rotated ? new Date().toISOString() : null,
    ],
  );

  return {
    id,
    orgId: opts.orgId,
    plaintext,
    hash,
    prefix,
    previousPlaintext,
    previousHash: previousHash ?? undefined,
  };
}

export async function seedApproval(
  db: IntegrationDb,
  opts: {
    orgId: string;
    connectionId: string;
    title?: string;
    status?: "pending" | "approved" | "rejected" | "cancelled" | "expired";
    idempotencyKey?: string;
    teamId?: string;
    expiresAt?: Date;
  },
): Promise<SeededApproval> {
  const id = randomUUID();
  await db.query(
    `INSERT INTO approval_requests (id, org_id, connection_id, title, status,
                                     idempotency_key, assigned_team_id, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      id,
      opts.orgId,
      opts.connectionId,
      opts.title ?? `Test approval ${id.slice(0, 6)}`,
      opts.status ?? "pending",
      opts.idempotencyKey ?? null,
      opts.teamId ?? null,
      opts.expiresAt ? opts.expiresAt.toISOString() : null,
    ],
  );
  return {
    id,
    orgId: opts.orgId,
    connectionId: opts.connectionId,
    status: opts.status ?? "pending",
    idempotencyKey: opts.idempotencyKey ?? null,
  };
}

export async function seedTeam(
  db: IntegrationDb,
  opts: { orgId: string; name?: string; members?: string[] },
): Promise<SeededTeam> {
  const id = randomUUID();
  const name = opts.name ?? `team-${id.slice(0, 6)}`;
  await db.query(
    `INSERT INTO teams (id, org_id, name) VALUES ($1, $2, $3)`,
    [id, opts.orgId, name],
  );
  for (const userId of opts.members ?? []) {
    await db.query(
      `INSERT INTO team_memberships (team_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [id, userId],
    );
  }
  return { id, orgId: opts.orgId, name };
}
