// ---------------------------------------------------------------------------
// OKrunit -- Tests for Approval Delegation
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase admin client mock -------------------------------------------

let mockQueryResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};
let mockInsertResult: { data: unknown; error: unknown } = {
  data: null,
  error: null,
};

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  const methods = [
    "select",
    "eq",
    "in",
    "lte",
    "gte",
    "or",
    "order",
    "limit",
    "insert",
    "update",
  ];

  for (const method of methods) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }

  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  chain.single = vi.fn().mockResolvedValue(result);

  // Make chain itself act as a thenable for queries that resolve the full chain
  Object.defineProperty(chain, "then", {
    value: (
      resolve: (v: unknown) => void,
      reject?: (v: unknown) => void,
    ) => {
      return Promise.resolve(result).then(resolve, reject);
    },
    configurable: true,
    enumerable: false,
  });

  return chain;
}

const mockFrom = vi.fn().mockImplementation(() => makeChain(mockQueryResult));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

import {
  getActiveDelegation,
  resolveDelegates,
  findDelegationForDelegate,
  createDelegation,
  cancelDelegation,
  DelegationError,
} from "../delegation";

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockQueryResult = { data: null, error: null };
  mockInsertResult = { data: null, error: null };
});

// ---- getActiveDelegation ----------------------------------------------------

describe("getActiveDelegation", () => {
  it("returns the active delegation when one exists", async () => {
    const delegation = {
      id: "del-1",
      org_id: "org-1",
      delegator_id: "user-1",
      delegate_id: "user-2",
      is_active: true,
      starts_at: "2026-01-01T00:00:00Z",
      ends_at: "2026-12-31T23:59:59Z",
      reason: "On vacation",
    };
    mockQueryResult = { data: delegation, error: null };

    const result = await getActiveDelegation("org-1", "user-1");

    expect(result).toEqual(delegation);
    expect(mockFrom).toHaveBeenCalledWith("approval_delegations");
  });

  it("returns null when no active delegation exists", async () => {
    mockQueryResult = { data: null, error: null };

    const result = await getActiveDelegation("org-1", "user-1");

    expect(result).toBeNull();
  });
});

// ---- resolveDelegates -------------------------------------------------------

describe("resolveDelegates", () => {
  it("returns a map of delegator to delegate for active delegations", async () => {
    mockQueryResult = {
      data: [
        { delegator_id: "user-1", delegate_id: "user-3" },
        { delegator_id: "user-2", delegate_id: "user-4" },
      ],
      error: null,
    };

    const result = await resolveDelegates("org-1", ["user-1", "user-2"]);

    expect(result).toBeInstanceOf(Map);
    expect(result.get("user-1")).toBe("user-3");
    expect(result.get("user-2")).toBe("user-4");
  });

  it("returns an empty map when no approverIds are provided", async () => {
    const result = await resolveDelegates("org-1", []);

    expect(result.size).toBe(0);
    // Should not even call the database
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns an empty map when no delegations match", async () => {
    mockQueryResult = { data: [], error: null };

    const result = await resolveDelegates("org-1", ["user-1"]);

    expect(result.size).toBe(0);
  });

  it("returns an empty map when data is null", async () => {
    mockQueryResult = { data: null, error: null };

    const result = await resolveDelegates("org-1", ["user-1"]);

    expect(result.size).toBe(0);
  });

  it("only takes the first delegation per delegator", async () => {
    mockQueryResult = {
      data: [
        { delegator_id: "user-1", delegate_id: "user-A" },
        { delegator_id: "user-1", delegate_id: "user-B" }, // Should be ignored
      ],
      error: null,
    };

    const result = await resolveDelegates("org-1", ["user-1"]);

    expect(result.get("user-1")).toBe("user-A");
    expect(result.size).toBe(1);
  });
});

// ---- findDelegationForDelegate ----------------------------------------------

describe("findDelegationForDelegate", () => {
  it("finds the delegation where a user acts as delegate", async () => {
    mockQueryResult = {
      data: [
        {
          id: "del-1",
          delegator_id: "user-1",
          delegate_id: "user-3",
        },
      ],
      error: null,
    };

    const result = await findDelegationForDelegate("org-1", "user-3", [
      "user-1",
      "user-2",
    ]);

    expect(result).toEqual({
      delegatorId: "user-1",
      delegationId: "del-1",
    });
  });

  it("returns null when no matching delegation exists", async () => {
    mockQueryResult = { data: [], error: null };

    const result = await findDelegationForDelegate("org-1", "user-3", [
      "user-1",
    ]);

    expect(result).toBeNull();
  });

  it("returns null when data is null", async () => {
    mockQueryResult = { data: null, error: null };

    const result = await findDelegationForDelegate("org-1", "user-3", [
      "user-1",
    ]);

    expect(result).toBeNull();
  });

  it("returns null when assignedApprovers is empty", async () => {
    const result = await findDelegationForDelegate("org-1", "user-3", []);

    expect(result).toBeNull();
    // Should not call the database
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

// ---- DelegationError --------------------------------------------------------

describe("DelegationError", () => {
  it("creates an error with the correct message and code", () => {
    const error = new DelegationError("Test error", "TEST_CODE");

    expect(error.message).toBe("Test error");
    expect(error.code).toBe("TEST_CODE");
    expect(error.name).toBe("DelegationError");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DelegationError);
  });

  it("is catchable as a standard Error", () => {
    const fn = () => {
      throw new DelegationError("Failed", "FAIL");
    };

    expect(fn).toThrow(Error);
    expect(fn).toThrow(DelegationError);
  });
});

// ---- createDelegation -------------------------------------------------------

describe("createDelegation", () => {
  it("throws DelegationError with DUPLICATE_DELEGATION on unique constraint violation", async () => {
    mockQueryResult = {
      data: null,
      error: { code: "23505", message: "duplicate key" },
    };

    await expect(
      createDelegation(
        "org-1",
        "user-1",
        "user-2",
        "Going on vacation",
        "2026-04-01T00:00:00Z",
        "2026-04-15T00:00:00Z",
      ),
    ).rejects.toThrow(DelegationError);

    try {
      await createDelegation(
        "org-1",
        "user-1",
        "user-2",
        null,
        "2026-04-01T00:00:00Z",
        "2026-04-15T00:00:00Z",
      );
    } catch (err) {
      expect(err).toBeInstanceOf(DelegationError);
      expect((err as DelegationError).code).toBe("DUPLICATE_DELEGATION");
    }
  });

  it("throws DelegationError with CREATE_FAILED on generic error", async () => {
    mockQueryResult = {
      data: null,
      error: { code: "42000", message: "Something went wrong" },
    };

    try {
      await createDelegation(
        "org-1",
        "user-1",
        "user-2",
        null,
        "2026-04-01T00:00:00Z",
        "2026-04-15T00:00:00Z",
      );
    } catch (err) {
      expect(err).toBeInstanceOf(DelegationError);
      expect((err as DelegationError).code).toBe("CREATE_FAILED");
    }
  });
});

// ---- cancelDelegation -------------------------------------------------------

describe("cancelDelegation", () => {
  it("throws DelegationError with NOT_FOUND when delegation does not exist", async () => {
    mockQueryResult = { data: null, error: null };

    try {
      await cancelDelegation("org-1", "del-nonexistent");
    } catch (err) {
      expect(err).toBeInstanceOf(DelegationError);
      expect((err as DelegationError).code).toBe("NOT_FOUND");
    }
  });
});
