/**
 * Tests for the OKRunit GitHub Actions integration.
 *
 * Mocks @actions/core, @actions/github, and global fetch to validate
 * the action's behavior without making real API calls.
 */

// ---------------------------------------------------------------------------
// Mock setup — must be declared before any imports.
// We keep stable references so that after jest.resetModules() the re-required
// source module binds to the same mock objects we assert against.
// ---------------------------------------------------------------------------

const coreMock = {
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
};

const githubContextMock = {
  workflow: "Deploy Production",
  runId: 123456,
  runNumber: 42,
  actor: "octocat",
  ref: "refs/heads/main",
  sha: "abc123def456",
  eventName: "push",
  repo: { owner: "my-org", repo: "my-repo" },
};

jest.mock("@actions/core", () => coreMock);
jest.mock("@actions/github", () => ({ context: githubContextMock }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APPROVAL_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeApproval(overrides: Record<string, unknown> = {}) {
  return {
    id: APPROVAL_ID,
    title: "Approval required: Deploy Production #42",
    description: "deploy the thing",
    status: "pending",
    priority: "medium",
    action_type: "deploy",
    source: "github-actions",
    required_approvals: 1,
    current_approvals: 0,
    requested_by_name: "octocat",
    metadata: {},
    decided_by: null,
    decided_by_name: null,
    decided_at: null,
    decision_comment: null,
    decision_source: null,
    risk_score: null,
    risk_level: null,
    auto_approved: false,
    execution_status: "immediate",
    conditions_met: true,
    sla_breached: false,
    expires_at: null,
    created_at: "2026-02-21T10:00:00.000Z",
    updated_at: "2026-02-21T10:00:00.000Z",
    ...overrides,
  };
}

function makeDecidedApproval(
  status: "approved" | "rejected",
  overrides: Record<string, unknown> = {},
) {
  return makeApproval({
    status,
    decided_by: "user-id-999",
    decided_by_name: "Jane Reviewer",
    decided_at: "2026-02-21T10:30:00.000Z",
    decision_comment: status === "approved" ? "LGTM" : "Not ready",
    decision_source: "dashboard",
    current_approvals: status === "approved" ? 1 : 0,
    updated_at: "2026-02-21T10:30:00.000Z",
    ...overrides,
  });
}

function setupDefaultInputs(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    "api-key": "ok_test_key",
    "api-url": "https://app.okrunit.com",
    title: "",
    description: "deploy the thing",
    "action-type": "",
    priority: "medium",
    metadata: "",
    "context-html": "",
    "required-approvals": "1",
    "assigned-approvers": "",
    "assigned-team-id": "",
    "is-sequential": "false",
    "auto-action": "",
    "auto-action-after-minutes": "",
    "callback-url": "",
    "callback-headers": "",
    "expires-at": "",
    "require-rejection-reason": "false",
    "notify-channel-ids": "",
    conditions: "",
    timeout: "5",
    "poll-interval": "0",
    ...overrides,
  };
  coreMock.getInput.mockImplementation((name: string) => defaults[name] ?? "");
}

function setupFetchMock(
  responses: Array<{ ok: boolean; body: unknown; status?: number }>,
) {
  const fetchMock = jest.fn();
  for (const resp of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 400),
      json: () => Promise.resolve(resp.body),
      text: () =>
        Promise.resolve(
          typeof resp.body === "string"
            ? resp.body
            : JSON.stringify(resp.body),
        ),
    });
  }
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/**
 * Re-require the action module so `run()` executes from scratch.
 *
 * Because `run()` is fire-and-forget at the module level, we need to give the
 * event loop a chance to drain all micro-tasks (the async `run` function and
 * all the awaited fetches inside it). We flush by awaiting a series of
 * micro-task ticks.
 */
async function runAction(): Promise<void> {
  jest.resetModules();

  // Re-register mocks so the freshly-required module gets our stable objects
  jest.mock("@actions/core", () => coreMock);
  jest.mock("@actions/github", () => ({ context: githubContextMock }));

  require("../src/index");

  // Drain micro-tasks — the run() promise chains multiple awaits (fetch calls,
  // sleep, JSON parsing). We flush generously to cover all of them.
  // Each poll cycle involves: sleep resolve -> fetch -> resp.json() parse,
  // so we need enough ticks to cover the worst case (multiple polls).
  for (let i = 0; i < 500; i++) {
    await new Promise((r) => setImmediate(r));
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Date, "now").mockReturnValue(1700000000000);
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---- 1. Priority validation ------------------------------------------------

describe("priority validation", () => {
  it("rejects an invalid priority value", async () => {
    setupDefaultInputs({ priority: "urgent" });
    setupFetchMock([]);

    await runAction();

    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Invalid priority "urgent"'),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it.each(["low", "medium", "high", "critical"])(
    "accepts valid priority '%s'",
    async (priority) => {
      setupDefaultInputs({ priority });
      setupFetchMock([
        { ok: true, body: makeApproval({ priority }) },
        { ok: true, body: makeDecidedApproval("approved") },
      ]);

      await runAction();

      expect(coreMock.setFailed).not.toHaveBeenCalled();
    },
  );
});

// ---- 2. Source is set to "github-actions" -----------------------------------

describe("source field", () => {
  it('sends source as "github-actions" in the create request', async () => {
    setupDefaultInputs();
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const createCall = fetchMock.mock.calls[0];
    const body = JSON.parse(createCall[1].body);
    expect(body.source).toBe("github-actions");
  });

  it("sends source_url pointing to the GitHub Actions run", async () => {
    setupDefaultInputs();
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const createCall = fetchMock.mock.calls[0];
    const body = JSON.parse(createCall[1].body);
    expect(body.source_url).toBe(
      "https://github.com/my-org/my-repo/actions/runs/123456",
    );
  });
});

// ---- 3. Idempotency key format ---------------------------------------------

describe("idempotency key", () => {
  it("matches format gha-{runId}-{runNumber}-{timestamp}", async () => {
    setupDefaultInputs();
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const createCall = fetchMock.mock.calls[0];
    const body = JSON.parse(createCall[1].body);
    expect(body.idempotency_key).toBe("gha-123456-42-1700000000000");
  });
});

// ---- 4. Default title generation -------------------------------------------

describe("default title", () => {
  it('generates "Approval required: {workflow} #{runNumber}" when no title input', async () => {
    setupDefaultInputs({ title: "" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const createCall = fetchMock.mock.calls[0];
    const body = JSON.parse(createCall[1].body);
    expect(body.title).toBe("Approval required: Deploy Production #42");
  });

  it("uses the user-supplied title when provided", async () => {
    setupDefaultInputs({ title: "Custom title" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval({ title: "Custom title" }) },
      {
        ok: true,
        body: makeDecidedApproval("approved", { title: "Custom title" }),
      },
    ]);

    await runAction();

    const createCall = fetchMock.mock.calls[0];
    const body = JSON.parse(createCall[1].body);
    expect(body.title).toBe("Custom title");
  });
});

// ---- 5. GitHub context metadata included ------------------------------------

describe("GitHub context metadata", () => {
  it("includes repo, workflow, actor, ref, sha in metadata", async () => {
    setupDefaultInputs();
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const createCall = fetchMock.mock.calls[0];
    const body = JSON.parse(createCall[1].body);

    expect(body.metadata).toEqual(
      expect.objectContaining({
        repository: "my-org/my-repo",
        workflow: "Deploy Production",
        actor: "octocat",
        ref: "refs/heads/main",
        sha: "abc123def456",
        run_id: 123456,
        run_number: 42,
        event_name: "push",
      }),
    );
  });

  it("merges user-supplied metadata with GitHub context", async () => {
    setupDefaultInputs({
      metadata: '{"env": "production", "ticket": "JIRA-42"}',
    });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const createCall = fetchMock.mock.calls[0];
    const body = JSON.parse(createCall[1].body);

    expect(body.metadata.repository).toBe("my-org/my-repo");
    expect(body.metadata.env).toBe("production");
    expect(body.metadata.ticket).toBe("JIRA-42");
  });

  it("warns but continues when metadata JSON is invalid", async () => {
    setupDefaultInputs({ metadata: "not-valid-json{" });
    setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    expect(coreMock.warning).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse metadata"),
    );
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });
});

// ---- 6. All expected outputs set after approval -----------------------------

describe("outputs on approval", () => {
  const expectedOutputs: Record<string, unknown> = {
    "approval-id": APPROVAL_ID,
    status: "approved",
    "decided-by": "Jane Reviewer",
    "decided-at": "2026-02-21T10:30:00.000Z",
    "decision-comment": "LGTM",
    "decision-source": "dashboard",
    description: "deploy the thing",
    priority: "medium",
    source: "github-actions",
    "action-type": "deploy",
    "required-approvals": 1,
    "current-approvals": 1,
    "updated-at": "2026-02-21T10:30:00.000Z",
    "risk-score": "",
    "risk-level": "",
    "auto-approved": false,
    "execution-status": "immediate",
    "conditions-met": true,
    "sla-breached": false,
    "expires-at": "",
    metadata: "{}",
  };

  it("sets all required outputs after an approved decision", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    for (const [key, value] of Object.entries(expectedOutputs)) {
      expect(coreMock.setOutput).toHaveBeenCalledWith(key, value);
    }
  });

  it.each(Object.keys(expectedOutputs))(
    "sets output '%s'",
    async (outputName) => {
      setupDefaultInputs();
      setupFetchMock([
        { ok: true, body: makeApproval() },
        { ok: true, body: makeDecidedApproval("approved") },
      ]);

      await runAction();

      const calls = coreMock.setOutput.mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(calls).toContain(outputName);
    },
  );
});

// ---- 7. Action fails on rejection ------------------------------------------

describe("rejection handling", () => {
  it("calls setFailed when the approval is rejected", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("rejected") },
    ]);

    await runAction();

    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("rejected"),
    );
  });

  it("includes the reviewer name and comment in the failure message", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      {
        ok: true,
        body: makeDecidedApproval("rejected", {
          decided_by_name: "Bob",
          decision_comment: "Needs more tests",
        }),
      },
    ]);

    await runAction();

    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringMatching(/Bob.*Needs more tests/),
    );
  });

  it("still sets all outputs before failing on rejection", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("rejected") },
    ]);

    await runAction();

    expect(coreMock.setOutput).toHaveBeenCalledWith("status", "rejected");
    expect(coreMock.setOutput).toHaveBeenCalledWith(
      "decided-by",
      "Jane Reviewer",
    );
  });
});

// ---- 8. Action fails on timeout --------------------------------------------

describe("timeout handling", () => {
  it("calls setFailed when the approval times out", async () => {
    setupDefaultInputs({ timeout: "0" });
    setupFetchMock([{ ok: true, body: makeApproval() }]);

    await runAction();

    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("timed out"),
    );
  });

  it('sets status output to "timeout"', async () => {
    setupDefaultInputs({ timeout: "0" });
    setupFetchMock([{ ok: true, body: makeApproval() }]);

    await runAction();

    expect(coreMock.setOutput).toHaveBeenCalledWith("status", "timeout");
  });
});

// ---- 9. Validate action.yml outputs ----------------------------------------

describe("action.yml output definitions", () => {
  const fs = require("fs");
  const path = require("path");
  const actionYmlPath = path.resolve(
    __dirname,
    "..",
    "action.yml",
  );

  const requiredOutputs = [
    "approval-id",
    "status",
    "decided-by",
    "decided-at",
    "decision-comment",
    "decision-source",
    "description",
    "priority",
    "source",
    "action-type",
    "required-approvals",
    "current-approvals",
    "updated-at",
    "risk-score",
    "risk-level",
    "auto-approved",
    "execution-status",
    "conditions-met",
    "sla-breached",
    "expires-at",
    "metadata",
  ];

  const actionYmlContent: string = fs.readFileSync(actionYmlPath, "utf-8");

  it.each(requiredOutputs)(
    "action.yml defines output '%s'",
    (outputName) => {
      const pattern = new RegExp(`^\\s+${outputName}:`, "m");
      expect(actionYmlContent).toMatch(pattern);
    },
  );
});

// ---- 10. API error handling -------------------------------------------------

describe("API error handling", () => {
  it("calls setFailed when the create request fails", async () => {
    setupDefaultInputs();
    setupFetchMock([{ ok: false, status: 401, body: "Unauthorized" }]);

    await runAction();

    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("OKRunit API error (401)"),
    );
  });

  it("calls setFailed when the poll request fails", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: false, status: 500, body: "Internal Server Error" },
    ]);

    await runAction();

    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("OKRunit API error (500)"),
    );
  });
});

// ---- 11. Polling behavior ---------------------------------------------------

describe("polling behavior", () => {
  it("polls until the approval is decided", async () => {
    setupDefaultInputs({ timeout: "60" });
    const pending = makeApproval();
    const approved = makeDecidedApproval("approved");

    const fetchMock = setupFetchMock([
      { ok: true, body: pending }, // create
      { ok: true, body: pending }, // poll 1
      { ok: true, body: pending }, // poll 2
      { ok: true, body: approved }, // poll 3
    ]);

    await runAction();

    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(coreMock.setOutput).toHaveBeenCalledWith("status", "approved");
    expect(coreMock.setFailed).not.toHaveBeenCalled();
  });
});

// ---- 12. Request structure --------------------------------------------------

describe("API request structure", () => {
  it("sends correct authorization header", async () => {
    setupDefaultInputs({ "api-key": "ok_my_secret_key" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const createCall = fetchMock.mock.calls[0];
    expect(createCall[1].headers.Authorization).toBe(
      "Bearer ok_my_secret_key",
    );
  });

  it("POSTs to the correct endpoint", async () => {
    setupDefaultInputs({ "api-url": "https://custom.okrunit.io" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://custom.okrunit.io/api/v1/approvals",
    );
  });

  it("GETs the correct poll endpoint with the approval ID", async () => {
    setupDefaultInputs();
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    expect(fetchMock.mock.calls[1][0]).toBe(
      `https://app.okrunit.com/api/v1/approvals/${APPROVAL_ID}`,
    );
  });
});

// ---- 13. Advanced inputs ----------------------------------------------------

describe("advanced inputs", () => {
  it("sends action_type when provided", async () => {
    setupDefaultInputs({ "action-type": "deploy" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.action_type).toBe("deploy");
  });

  it("sends context_html when provided", async () => {
    setupDefaultInputs({ "context-html": "<h1>Deploy diff</h1>" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.context_html).toBe("<h1>Deploy diff</h1>");
  });

  it("sends required_approvals when > 1", async () => {
    setupDefaultInputs({ "required-approvals": "3" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval({ required_approvals: 3 }) },
      { ok: true, body: makeDecidedApproval("approved", { required_approvals: 3, current_approvals: 3 }) },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.required_approvals).toBe(3);
  });

  it("does not send required_approvals when default (1)", async () => {
    setupDefaultInputs({ "required-approvals": "1" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.required_approvals).toBeUndefined();
  });

  it("sends assigned_approvers as array from comma-separated input", async () => {
    setupDefaultInputs({
      "assigned-approvers": "uuid-1, uuid-2, uuid-3",
    });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.assigned_approvers).toEqual(["uuid-1", "uuid-2", "uuid-3"]);
  });

  it("sends assigned_team_id when provided", async () => {
    setupDefaultInputs({ "assigned-team-id": "team-uuid-1" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.assigned_team_id).toBe("team-uuid-1");
  });

  it("sends auto_action and auto_action_after_minutes", async () => {
    setupDefaultInputs({
      "auto-action": "approve",
      "auto-action-after-minutes": "30",
    });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.auto_action).toBe("approve");
    expect(body.auto_action_after_minutes).toBe(30);
  });

  it("rejects invalid auto-action value", async () => {
    setupDefaultInputs({ "auto-action": "delay" });
    setupFetchMock([]);

    await runAction();

    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringContaining('Invalid auto-action "delay"'),
    );
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sends callback_url and callback_headers", async () => {
    setupDefaultInputs({
      "callback-url": "https://hooks.example.com/deploy",
      "callback-headers": '{"X-Secret": "abc123"}',
    });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.callback_url).toBe("https://hooks.example.com/deploy");
    expect(body.callback_headers).toEqual({ "X-Secret": "abc123" });
  });

  it("warns on invalid callback-headers JSON", async () => {
    setupDefaultInputs({
      "callback-url": "https://hooks.example.com/deploy",
      "callback-headers": "not-json",
    });
    setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    expect(coreMock.warning).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse callback-headers"),
    );
  });

  it("sends expires_at when provided", async () => {
    setupDefaultInputs({ "expires-at": "2026-12-31T23:59:59Z" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.expires_at).toBe("2026-12-31T23:59:59Z");
  });

  it("sends notify_channel_ids as array from comma-separated input", async () => {
    setupDefaultInputs({
      "notify-channel-ids": "chan-1, chan-2",
    });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.notify_channel_ids).toEqual(["chan-1", "chan-2"]);
  });

  it("sends conditions when provided as JSON", async () => {
    const conds = [{ name: "health-check", check_type: "webhook", webhook_url: "https://api.example.com/health" }];
    setupDefaultInputs({ conditions: JSON.stringify(conds) });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.conditions).toEqual(conds);
  });

  it("warns on invalid conditions JSON", async () => {
    setupDefaultInputs({ conditions: "bad-json" });
    setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    expect(coreMock.warning).toHaveBeenCalledWith(
      expect.stringContaining("Failed to parse conditions"),
    );
  });

  it("sends require_rejection_reason when true", async () => {
    setupDefaultInputs({ "require-rejection-reason": "true" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.require_rejection_reason).toBe(true);
  });

  it("sends is_sequential when true", async () => {
    setupDefaultInputs({ "is-sequential": "true" });
    const fetchMock = setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeDecidedApproval("approved") },
    ]);

    await runAction();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.is_sequential).toBe(true);
  });
});

// ---- 14. Cancelled and expired statuses -------------------------------------

describe("cancelled and expired handling", () => {
  it("calls setFailed when the approval is cancelled", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeApproval({ status: "cancelled" }) },
    ]);

    await runAction();

    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("cancelled"),
    );
  });

  it("calls setFailed when the approval is expired", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      { ok: true, body: makeApproval({ status: "expired", expires_at: "2026-02-21T11:00:00.000Z" }) },
    ]);

    await runAction();

    expect(coreMock.setFailed).toHaveBeenCalledWith(
      expect.stringContaining("expired"),
    );
  });
});

// ---- 15. New outputs populated from response --------------------------------

describe("new outputs from response", () => {
  it("sets risk-score and risk-level when present", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      {
        ok: true,
        body: makeDecidedApproval("approved", {
          risk_score: 75,
          risk_level: "high",
        }),
      },
    ]);

    await runAction();

    expect(coreMock.setOutput).toHaveBeenCalledWith("risk-score", 75);
    expect(coreMock.setOutput).toHaveBeenCalledWith("risk-level", "high");
  });

  it("sets auto-approved output", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      {
        ok: true,
        body: makeDecidedApproval("approved", { auto_approved: true }),
      },
    ]);

    await runAction();

    expect(coreMock.setOutput).toHaveBeenCalledWith("auto-approved", true);
  });

  it("sets sla-breached output", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      {
        ok: true,
        body: makeDecidedApproval("approved", { sla_breached: true }),
      },
    ]);

    await runAction();

    expect(coreMock.setOutput).toHaveBeenCalledWith("sla-breached", true);
  });

  it("sets metadata as JSON string", async () => {
    setupDefaultInputs();
    setupFetchMock([
      { ok: true, body: makeApproval() },
      {
        ok: true,
        body: makeDecidedApproval("approved", {
          metadata: { env: "prod", version: "1.2.3" },
        }),
      },
    ]);

    await runAction();

    expect(coreMock.setOutput).toHaveBeenCalledWith(
      "metadata",
      '{"env":"prod","version":"1.2.3"}',
    );
  });
});
