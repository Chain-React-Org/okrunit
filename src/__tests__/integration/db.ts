// ---------------------------------------------------------------------------
// Integration test database helper.
//
// Boots a fresh pglite (in-process Postgres) per test file, applies the
// Supabase preamble plus every supabase/migrations/*.sql file in
// lexicographic order, and exposes a small surface for tests:
//
//   - sql / query: raw SQL access against the live database
//   - actAs(userId): scope subsequent queries to a JWT subject so RLS
//     policies that call auth.uid() / auth_org_id() see the test user
//   - asServiceRole / asAnon: switch the simulated role
//   - reset: drop everything between tests in the same file
// ---------------------------------------------------------------------------

import { PGlite } from "@electric-sql/pglite";
import { promises as fs } from "fs";
import path from "path";

const PROJECT_ROOT = path.resolve(__dirname, "..", "..", "..");
const MIGRATIONS_DIR = path.join(PROJECT_ROOT, "supabase", "migrations");
const PREAMBLE_PATH = path.join(__dirname, "supabase-preamble.sql");

export interface IntegrationDb {
  /** Run a query that returns rows. */
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; affectedRows: number }>;
  /** Run one or more statements and discard results. */
  exec(sql: string): Promise<void>;
  /** Set request.jwt.claims so auth.uid() / auth.role() resolve to the user. */
  actAs(userId: string, claims?: Record<string, unknown>): Promise<void>;
  /** Drop the JWT context. Subsequent queries see auth.uid() = NULL. */
  asAnon(): Promise<void>;
  /** Bypass RLS for setup / verification queries. */
  asServiceRole(): Promise<void>;
  /** Underlying pglite instance for advanced cases. */
  raw: PGlite;
  /** Tear down the database. Idempotent. */
  close(): Promise<void>;
}

let cachedMigrationSql: string | null = null;

async function loadMigrations(): Promise<string> {
  if (cachedMigrationSql) return cachedMigrationSql;

  const preamble = await fs.readFile(PREAMBLE_PATH, "utf8");
  const files = (await fs.readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const parts: string[] = [preamble];
  for (const f of files) {
    const full = path.join(MIGRATIONS_DIR, f);
    const sql = await fs.readFile(full, "utf8");
    parts.push(`\n-- >>> migration: ${f} <<<\n`);
    parts.push(sql);
  }

  cachedMigrationSql = parts.join("\n");
  return cachedMigrationSql;
}

/**
 * Boot a fresh pglite, apply preamble + all migrations, and return a helper.
 *
 * Migrations that reference Supabase-specific features pglite cannot honor
 * (mostly publication ALTERs and a handful of GRANT-to-role statements) are
 * tolerated by the preamble. If a migration genuinely fails, we throw with
 * the failing migration name so it is easy to spot.
 */
export async function createIntegrationDb(): Promise<IntegrationDb> {
  const pg = new PGlite();
  const sql = await loadMigrations();

  // We apply each migration block as its own statement group so that one
  // failing migration produces an actionable error instead of a generic
  // "syntax error" buried in 50k lines.
  const blocks = sql.split(/-- >>> migration: (.+?) <<</);
  // blocks[0] = preamble (hand-authored, applied verbatim)
  // blocks[2k+1] = filename, blocks[2k+2] = body (preprocessed before exec)
  await applyBlock(pg, "supabase-preamble.sql", blocks[0] ?? "", { preprocess: false });
  for (let i = 1; i < blocks.length; i += 2) {
    const name = blocks[i] ?? "<unknown>";
    const body = blocks[i + 1] ?? "";
    await applyBlock(pg, name, body, { preprocess: true });
  }

  // pglite runs as the superuser "postgres" by default, which bypasses RLS.
  // To get authentic RLS enforcement we run RLS-mode queries under a non-
  // superuser role. The preamble has already created the `authenticated`
  // role; here we grant it the privileges it needs to actually issue
  // queries on the migrated schema.
  await pg.exec(`GRANT USAGE ON SCHEMA public TO authenticated`);
  await pg.exec(`GRANT USAGE ON SCHEMA auth TO authenticated`);
  await pg.exec(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated`,
  );
  await pg.exec(`GRANT SELECT ON ALL TABLES IN SCHEMA auth TO authenticated`);
  await pg.exec(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated`);
  await pg.exec(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated`);
  await pg.exec(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO authenticated`);
  await pg.exec(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated`);

  const db: IntegrationDb = {
    raw: pg,
    async query(text, params = []) {
      const r = await pg.query(text, params);
      return { rows: r.rows as never[], affectedRows: r.affectedRows ?? 0 };
    },
    async exec(text) {
      await pg.exec(text);
    },
    async actAs(userId, claims = {}) {
      const payload = JSON.stringify({ sub: userId, role: "authenticated", ...claims });
      // RESET ROLE first so we can issue the SET commands as superuser, then
      // switch into the non-superuser `authenticated` role; pglite enforces
      // RLS for non-superusers, which is what we want.
      await pg.query(`RESET ROLE`);
      await pg.query(`SELECT set_config('request.jwt.claims', $1, false)`, [payload]);
      await pg.query(`SELECT set_config('request.jwt.role', 'authenticated', false)`);
      await pg.query(`SET row_security = on`);
      await pg.query(`SET ROLE authenticated`);
    },
    async asAnon() {
      await pg.query(`RESET ROLE`);
      await pg.query(`SELECT set_config('request.jwt.claims', '{}', false)`);
      await pg.query(`SELECT set_config('request.jwt.role', 'anon', false)`);
      await pg.query(`SET row_security = on`);
      await pg.query(`SET ROLE anon`);
    },
    async asServiceRole() {
      // Service-role runs as the underlying superuser, which bypasses RLS.
      // This mirrors what createAdminClient() does in production.
      await pg.query(`RESET ROLE`);
      const payload = JSON.stringify({ role: "service_role" });
      await pg.query(`SELECT set_config('request.jwt.claims', $1, false)`, [payload]);
      await pg.query(`SELECT set_config('request.jwt.role', 'service_role', false)`);
    },
  };

  // Default to service-role / RLS-off until a test explicitly opts in.
  await db.asServiceRole();
  return db;
}

/**
 * Patterns we strip from migration SQL before applying to pglite. These are
 * Supabase-platform features pglite does not implement; the tests do not
 * depend on them, so silently dropping is correct.
 */
const TOLERATED_PATTERNS: RegExp[] = [
  // CREATE EXTENSION pgcrypto / extensions.pgcrypto / etc.
  /^\s*CREATE\s+EXTENSION\b[^;]*;/gim,
  // GRANT to roles supabase provides; pglite has its own user model.
  /^\s*GRANT\b[^;]*\bTO\s+(?:authenticated|anon|service_role|supabase_auth_admin|supabase_realtime_admin|postgres)[^;]*;/gim,
  // REVOKE from supabase roles; same rationale.
  /^\s*REVOKE\b[^;]*\bFROM\s+(?:authenticated|anon|service_role|supabase_auth_admin|supabase_realtime_admin|postgres)[^;]*;/gim,
  // ALTER DEFAULT PRIVILEGES ... TO supabase_role — same rationale.
  /^\s*ALTER\s+DEFAULT\s+PRIVILEGES\b[^;]*;/gim,
  // ALTER PUBLICATION supabase_realtime ADD ... — preamble created the publication empty; tracking adds is unnecessary.
  /^\s*ALTER\s+PUBLICATION\s+supabase_realtime\b[^;]*;/gim,
  // ALTER ROLE / CREATE ROLE statements — pglite runs single-user.
  /^\s*(?:CREATE|ALTER)\s+ROLE\b[^;]*;/gim,
  // SECURITY LABEL — only used for pgsodium key management.
  /^\s*SECURITY\s+LABEL\b[^;]*;/gim,
];

/**
 * Substitutions applied to migration SQL. RLS policies in production reference
 * Supabase-managed roles via `TO authenticated` or `TO service_role` clauses.
 * pglite has no such roles. Stripping the role clause turns the policy into
 * an all-roles policy, which is correct for our tests because we simulate the
 * user identity via request.jwt.claims rather than via role membership.
 */
const TO_ROLE_CLAUSE = /\sTO\s+(?:authenticated|anon|service_role|supabase_auth_admin|supabase_realtime_admin|postgres)(?:\s*,\s*(?:authenticated|anon|service_role|supabase_auth_admin|supabase_realtime_admin|postgres))*/gi;

function preprocessSql(body: string): string {
  let out = body;
  for (const re of TOLERATED_PATTERNS) {
    out = out.replace(re, "");
  }
  out = out.replace(TO_ROLE_CLAUSE, " ");
  return out;
}

async function applyBlock(
  pg: PGlite,
  name: string,
  body: string,
  opts: { preprocess: boolean } = { preprocess: true },
): Promise<void> {
  const sql = opts.preprocess ? preprocessSql(body) : body;
  if (!sql.trim()) return;
  try {
    await pg.exec(sql);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed applying migration ${name}: ${msg}`);
  }
}
