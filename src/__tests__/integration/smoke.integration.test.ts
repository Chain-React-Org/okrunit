import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createIntegrationDb, type IntegrationDb } from "./db";

let db: IntegrationDb;

beforeAll(async () => {
  db = await createIntegrationDb();
}, 120_000);

afterAll(async () => {
  await db?.raw.close();
});

describe("integration db smoke", () => {
  it("applies the preamble and core tables exist", async () => {
    const tables = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN
          ('organizations','user_profiles','connections','approval_requests')
        ORDER BY table_name`,
    );
    expect(tables.rows.map((r) => r.table_name)).toEqual([
      "approval_requests",
      "connections",
      "organizations",
      "user_profiles",
    ]);
  });
});
