// ---------------------------------------------------------------------------
// OKrunit -- Tests for canUserDecideServerSide
// ---------------------------------------------------------------------------
// The web-app-side canDecideOnApproval has exhaustive tests elsewhere; this
// file covers the server-side helper that messaging inbound handlers use,
// which additionally consults approval_votes (double-vote guard),
// approval_delegations (delegate fallback), user_profiles (waiting-on name),
// org_memberships (role hierarchy), and organizations (four-eyes config).
// We stub those queries via a minimal mock Supabase client.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { canUserDecideServerSide } from "../can-decide-server";
import type { ApprovalRequest } from "@/lib/types/database";

type ApprovalFixture = Pick<
  ApprovalRequest,
  | "id"
  | "org_id"
  | "status"
  | "expires_at"
  | "assigned_approvers"
  | "is_sequential"
  | "current_approvals"
  | "required_approvals"
  | "required_role"
  | "created_by"
  | "action_type"
  | "priority"
>;

const ORG = "org-1";
const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";
const USER_C = "00000000-0000-0000-0000-00000000000c";

function makeApproval(overrides: Partial<ApprovalFixture> = {}): ApprovalFixture {
  return {
    id: "req-1",
    org_id: ORG,
    status: "pending",
    expires_at: null,
    assigned_approvers: null,
    is_sequential: false,
    current_approvals: 0,
    required_approvals: 1,
    required_role: null,
    created_by: null,
    action_type: "deploy",
    priority: "medium",
    ...overrides,
  };
}

/**
 * Minimal mock of a Supabase query builder that returns a canned shape for
 * each (table, filter) combination. Only models the methods canUserDecide
 * actually chains.
 */
function makeMockAdmin(config: {
  votes?: { user_id: string }[];
  delegation?: { delegatorId: string; delegationId: string } | null;
  profile?: { full_name?: string | null; email?: string | null };
  membershipRole?: string;
  fourEyesConfig?: { enabled: boolean; action_types: string[]; min_priority: string | null };
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = (table: string): any => {
    if (table === "approval_votes") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data:
                    (config.votes ?? []).length > 0 &&
                    (config.votes ?? []).some((v) => v.user_id === "__checked__")
                      ? { id: "v1" }
                      : null,
                }),
            }),
          }),
        }),
      };
    }
    if (table === "approval_delegations") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                lte: () => ({
                  gte: () => ({
                    in: () =>
                      Promise.resolve({
                        data: config.delegation
                          ? [
                              {
                                id: config.delegation.delegationId,
                                delegator_id: config.delegation.delegatorId,
                                delegate_id: "__delegate__",
                              },
                            ]
                          : [],
                      }),
                  }),
                }),
              }),
            }),
          }),
        }),
      };
    }
    if (table === "user_profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: config.profile ?? null,
              }),
          }),
        }),
      };
    }
    if (table === "org_memberships") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: config.membershipRole ? { role: config.membershipRole } : null,
                }),
            }),
          }),
        }),
      };
    }
    if (table === "organizations") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: config.fourEyesConfig
                  ? { four_eyes_config: config.fourEyesConfig }
                  : null,
              }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: builder } as any;
}

// Convenience: mock where a prior vote by USER_A exists.
function mockWithVote(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const builder = (table: string): any => {
    if (table === "approval_votes") {
      return {
        select: () => ({
          eq: (col: string, val: string) => ({
            // First eq: request_id. Second eq: user_id.
            eq: (_col2: string, val2: string) => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: val2 === userId ? { id: "v1" } : null,
                }),
            }),
            // list-style: select("user_id").eq(request_id) → returns all votes.
            then: (resolve: (result: { data: { user_id: string }[] }) => unknown) =>
              resolve({ data: [{ user_id: userId }] }),
          }),
        }),
      };
    }
    if (table === "user_profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({ data: { full_name: "Bob Jones", email: "bob@x.com" } }),
          }),
        }),
      };
    }
    if (table === "approval_delegations" || table === "org_memberships" || table === "organizations") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                lte: () => ({
                  gte: () => ({
                    in: () => Promise.resolve({ data: [] }),
                  }),
                }),
              }),
              maybeSingle: () => Promise.resolve({ data: null }),
            }),
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { from: builder } as any;
}

// ---- Tests -----------------------------------------------------------------

describe("canUserDecideServerSide", () => {
  it("rejects when request is not pending", async () => {
    const admin = makeMockAdmin({});
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({ status: "approved" }),
      actorUserId: USER_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_PENDING");
  });

  it("rejects when request has expired", async () => {
    const admin = makeMockAdmin({});
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({ expires_at: past }),
      actorUserId: USER_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("EXPIRED");
  });

  it("blocks self-approval in the default any-approver case", async () => {
    const admin = makeMockAdmin({});
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({
        created_by: { type: "oauth", user_id: USER_A },
      }),
      actorUserId: USER_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("SELF_APPROVAL_BLOCKED");
  });

  it("allows the creator when explicitly added to the chain", async () => {
    const admin = makeMockAdmin({});
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({
        assigned_approvers: [USER_A, USER_B],
        created_by: { type: "oauth", user_id: USER_A },
      }),
      actorUserId: USER_A,
    });
    expect(result.ok).toBe(true);
  });

  it("rejects users not in assigned_approvers and without a delegation", async () => {
    const admin = makeMockAdmin({ delegation: null });
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({ assigned_approvers: [USER_A, USER_B] }),
      actorUserId: USER_C,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("NOT_ASSIGNED_APPROVER");
  });

  it("allows a non-assigned user when they hold a delegation from an assignee", async () => {
    const admin = makeMockAdmin({
      delegation: { delegatorId: USER_A, delegationId: "d1" },
    });
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({ assigned_approvers: [USER_A, USER_B] }),
      actorUserId: USER_C,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.delegatedFrom).toBe(USER_A);
  });

  it("blocks the second approver from voting before the first on a sequential chain", async () => {
    const admin = mockWithVote("__nobody_voted_yet__");
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({
        assigned_approvers: [USER_A, USER_B],
        is_sequential: true,
        current_approvals: 0,
      }),
      actorUserId: USER_B,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("NOT_YOUR_TURN");
      expect(result.reason).toContain("Bob Jones");
    }
  });

  it("allows the second approver after the first has voted", async () => {
    const admin = mockWithVote(USER_A);
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({
        assigned_approvers: [USER_A, USER_B],
        is_sequential: true,
        current_approvals: 1,
      }),
      actorUserId: USER_B,
    });
    expect(result.ok).toBe(true);
  });

  it("enforces required_role when present", async () => {
    const admin = makeMockAdmin({ membershipRole: "member" });
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({ required_role: "admin" }),
      actorUserId: USER_A,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("INSUFFICIENT_ROLE");
  });

  it("allows an admin when required_role is admin", async () => {
    const admin = makeMockAdmin({ membershipRole: "admin" });
    const result = await canUserDecideServerSide(admin, {
      approval: makeApproval({ required_role: "admin" }),
      actorUserId: USER_A,
    });
    expect(result.ok).toBe(true);
  });
});
