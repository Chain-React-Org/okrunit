// ---------------------------------------------------------------------------
// OKrunit -- Tests for canDecideOnApproval
// ---------------------------------------------------------------------------
// Covers the sequential position check, parallel membership, delegation,
// and the self-approval carveout: creator-on-chain is allowed, creator
// not-on-chain is still blocked.
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { canDecideOnApproval } from "../responsible";
import type { ApprovalRequest } from "@/lib/types/database";

type ApprovalFixture = Pick<
  ApprovalRequest,
  | "status"
  | "is_log"
  | "assigned_approvers"
  | "is_sequential"
  | "current_approvals"
  | "created_by"
>;

const USER_A = "00000000-0000-0000-0000-00000000000a";
const USER_B = "00000000-0000-0000-0000-00000000000b";
const USER_C = "00000000-0000-0000-0000-00000000000c";

function makeApproval(overrides: Partial<ApprovalFixture> = {}): ApprovalFixture {
  return {
    status: "pending",
    is_log: false,
    assigned_approvers: null,
    is_sequential: false,
    current_approvals: 0,
    created_by: null,
    ...overrides,
  };
}

describe("canDecideOnApproval — trivial gates", () => {
  it("returns false without a currentUserId", () => {
    expect(canDecideOnApproval(makeApproval(), undefined, true)).toBe(false);
  });

  it("returns false when canApprove is false", () => {
    expect(canDecideOnApproval(makeApproval(), USER_A, false)).toBe(false);
  });

  it("returns false when the approval is not pending", () => {
    expect(
      canDecideOnApproval(makeApproval({ status: "approved" }), USER_A, true),
    ).toBe(false);
  });

  it("returns false for activity log entries", () => {
    expect(canDecideOnApproval(makeApproval({ is_log: true }), USER_A, true)).toBe(
      false,
    );
  });
});

describe("canDecideOnApproval — no assigned chain (any-approver mode)", () => {
  it("allows any permitted user when no chain is set", () => {
    expect(canDecideOnApproval(makeApproval(), USER_A, true)).toBe(true);
  });

  it("still blocks self-approval in any-approver mode", () => {
    const approval = makeApproval({ created_by: { user_id: USER_A } as unknown as ApprovalRequest["created_by"] });
    expect(canDecideOnApproval(approval, USER_A, true)).toBe(false);
  });
});

describe("canDecideOnApproval — sequential chain", () => {
  it("allows the next-in-line approver", () => {
    const approval = makeApproval({
      is_sequential: true,
      assigned_approvers: [USER_A, USER_B, USER_C],
      current_approvals: 0,
    });
    expect(canDecideOnApproval(approval, USER_A, true)).toBe(true);
    expect(canDecideOnApproval(approval, USER_B, true)).toBe(false);
  });

  it("advances eligibility as approvals accumulate", () => {
    const approval = makeApproval({
      is_sequential: true,
      assigned_approvers: [USER_A, USER_B, USER_C],
      current_approvals: 1,
    });
    expect(canDecideOnApproval(approval, USER_A, true)).toBe(false);
    expect(canDecideOnApproval(approval, USER_B, true)).toBe(true);
    expect(canDecideOnApproval(approval, USER_C, true)).toBe(false);
  });

  it("returns false when current_approvals points past the end", () => {
    const approval = makeApproval({
      is_sequential: true,
      assigned_approvers: [USER_A],
      current_approvals: 1,
    });
    expect(canDecideOnApproval(approval, USER_A, true)).toBe(false);
  });
});

describe("canDecideOnApproval — parallel chain", () => {
  it("allows any assigned approver", () => {
    const approval = makeApproval({
      assigned_approvers: [USER_A, USER_B],
      current_approvals: 0,
    });
    expect(canDecideOnApproval(approval, USER_A, true)).toBe(true);
    expect(canDecideOnApproval(approval, USER_B, true)).toBe(true);
  });

  it("blocks users who aren't on the chain", () => {
    const approval = makeApproval({
      assigned_approvers: [USER_A, USER_B],
    });
    expect(canDecideOnApproval(approval, USER_C, true)).toBe(false);
  });
});

describe("canDecideOnApproval — delegation", () => {
  it("treats a delegate as eligible when their delegator is next in line", () => {
    const approval = makeApproval({
      is_sequential: true,
      assigned_approvers: [USER_A, USER_B],
      current_approvals: 0,
    });
    // User C is a delegate for User A (who is next in the chain).
    expect(
      canDecideOnApproval(approval, USER_C, true, new Set([USER_A])),
    ).toBe(true);
  });

  it("does not elevate a delegate when their delegator is not next", () => {
    const approval = makeApproval({
      is_sequential: true,
      assigned_approvers: [USER_A, USER_B],
      current_approvals: 0,
    });
    // User C delegates for User B (later in chain) — still blocked for now.
    expect(
      canDecideOnApproval(approval, USER_C, true, new Set([USER_B])),
    ).toBe(false);
  });

  it("lets a delegate act in a parallel chain when any delegator is assigned", () => {
    const approval = makeApproval({
      assigned_approvers: [USER_A, USER_B],
    });
    expect(
      canDecideOnApproval(approval, USER_C, true, new Set([USER_A])),
    ).toBe(true);
  });
});

describe("canDecideOnApproval — self-approval carveout", () => {
  it("blocks the creator when they are NOT on the chain", () => {
    const approval = makeApproval({
      assigned_approvers: [USER_B, USER_C],
      created_by: { user_id: USER_A } as unknown as ApprovalRequest["created_by"],
    });
    expect(canDecideOnApproval(approval, USER_A, true)).toBe(false);
  });

  it("allows the creator when they were added to the chain explicitly", () => {
    const approval = makeApproval({
      assigned_approvers: [USER_B, USER_A],
      is_sequential: true,
      current_approvals: 1,
      created_by: { user_id: USER_A } as unknown as ApprovalRequest["created_by"],
    });
    expect(canDecideOnApproval(approval, USER_A, true)).toBe(true);
  });

  it("still honors sequential position for a creator on the chain", () => {
    const approval = makeApproval({
      assigned_approvers: [USER_B, USER_A],
      is_sequential: true,
      current_approvals: 0,
      created_by: { user_id: USER_A } as unknown as ApprovalRequest["created_by"],
    });
    // Creator is on the chain but it's B's turn — creator must wait.
    expect(canDecideOnApproval(approval, USER_A, true)).toBe(false);
  });

  it("allows creator in parallel mode when they're on the chain", () => {
    const approval = makeApproval({
      assigned_approvers: [USER_A, USER_B],
      created_by: { user_id: USER_A } as unknown as ApprovalRequest["created_by"],
    });
    expect(canDecideOnApproval(approval, USER_A, true)).toBe(true);
  });
});
