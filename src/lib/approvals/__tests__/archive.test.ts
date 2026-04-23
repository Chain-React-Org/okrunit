// ---------------------------------------------------------------------------
// OKrunit -- Tests for canArchiveApproval
// ---------------------------------------------------------------------------

import { describe, it, expect } from "vitest";
import { canArchiveApproval } from "../archive";
import type { ApprovalRequest, CreatedByInfo } from "@/lib/types/database";

const CREATOR = "11111111-1111-1111-1111-111111111111";
const SOMEONE_ELSE = "22222222-2222-2222-2222-222222222222";
const TEAM_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TEAM_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function approval(
  userId: string | null = CREATOR,
  assignedTeamId: string | null = null,
): Pick<ApprovalRequest, "created_by" | "assigned_team_id"> {
  const createdBy: CreatedByInfo | null = userId
    ? { type: "oauth", user_id: userId }
    : null;
  return { created_by: createdBy, assigned_team_id: assignedTeamId };
}

describe("canArchiveApproval", () => {
  it("returns false with no currentUserId", () => {
    expect(canArchiveApproval(approval(), undefined, "owner")).toBe(false);
  });

  it("allows the creator regardless of role", () => {
    expect(canArchiveApproval(approval(CREATOR), CREATOR, "member")).toBe(true);
    expect(canArchiveApproval(approval(CREATOR), CREATOR, "approver")).toBe(true);
  });

  it("allows an owner on any request", () => {
    expect(canArchiveApproval(approval(CREATOR), SOMEONE_ELSE, "owner")).toBe(true);
  });

  it("allows an admin on any request", () => {
    expect(canArchiveApproval(approval(CREATOR), SOMEONE_ELSE, "admin")).toBe(true);
  });

  it("blocks a plain member who didn't create the request", () => {
    expect(canArchiveApproval(approval(CREATOR), SOMEONE_ELSE, "member")).toBe(false);
  });

  it("blocks an approver who didn't create the request", () => {
    expect(canArchiveApproval(approval(CREATOR), SOMEONE_ELSE, "approver")).toBe(false);
  });

  it("blocks everyone when the request has no human creator (API key/service)", () => {
    expect(canArchiveApproval(approval(null), SOMEONE_ELSE, "member")).toBe(false);
    expect(canArchiveApproval(approval(null), SOMEONE_ELSE, "approver")).toBe(false);
  });

  it("still allows admins/owners on requests with no human creator", () => {
    expect(canArchiveApproval(approval(null), SOMEONE_ELSE, "admin")).toBe(true);
    expect(canArchiveApproval(approval(null), SOMEONE_ELSE, "owner")).toBe(true);
  });

  it("allows a team lead on requests assigned to their team", () => {
    expect(
      canArchiveApproval(
        approval(CREATOR, TEAM_A),
        SOMEONE_ELSE,
        "member",
        new Set([TEAM_A]),
      ),
    ).toBe(true);
  });

  it("blocks a team lead on requests assigned to a different team", () => {
    expect(
      canArchiveApproval(
        approval(CREATOR, TEAM_B),
        SOMEONE_ELSE,
        "member",
        new Set([TEAM_A]),
      ),
    ).toBe(false);
  });

  it("doesn't elevate a team lead on unassigned requests", () => {
    expect(
      canArchiveApproval(
        approval(CREATOR, null),
        SOMEONE_ELSE,
        "member",
        new Set([TEAM_A]),
      ),
    ).toBe(false);
  });
});
