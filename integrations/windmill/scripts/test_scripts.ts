// Comprehensive tests for OKRunit Windmill integration scripts
// Run with: deno test test_scripts.ts

import {
  assertEquals,
  assertMatch,
  assertRejects,
  assertStringIncludes,
} from "https://deno.land/std@0.220.0/assert/mod.ts";

// ---------------------------------------------------------------------------
// Helpers: mock fetch and shared fixtures
// ---------------------------------------------------------------------------

type Gatekeeper = {
  api_key: string;
  api_url: string;
};

const TEST_GK: Gatekeeper = {
  api_key: "test-api-key-123",
  api_url: "https://api.okrunit.test",
};

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Replace globalThis.fetch with a mock that captures requests and returns `responseBody`. */
function mockFetch(
  responseBody: unknown,
  status = 200,
): { captured: CapturedRequest[] } {
  const captured: CapturedRequest[] = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit,
  ) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? "GET";
    const headers: Record<string, string> = {};
    if (init?.headers) {
      const h = new Headers(init.headers as HeadersInit);
      h.forEach((v, k) => {
        headers[k.toLowerCase()] = v;
      });
    }
    let body: unknown = undefined;
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string);
      } catch {
        body = init.body;
      }
    }
    captured.push({ url, method, headers, body });

    const ok = status >= 200 && status < 300;
    return new Response(JSON.stringify(responseBody), {
      status,
      headers: { "Content-Type": "application/json" },
      // @ts-ignore: ok is derived from status automatically, but we
      // include it explicitly just in case
    });
  }) as typeof fetch;

  // Restore after current test finishes (Deno.test sanitizers friendly)
  // Callers should invoke restoreFetch() in a finally block or afterEach.
  (globalThis as Record<string, unknown>).__restoreFetch = () => {
    globalThis.fetch = originalFetch;
  };

  return { captured };
}

function restoreFetch() {
  const restore = (globalThis as Record<string, unknown>).__restoreFetch as
    | (() => void)
    | undefined;
  if (restore) restore();
}

// ---------------------------------------------------------------------------
// Dynamic imports. We import each script's `main` at runtime so the mock
// fetch is in place when the function runs. Because Deno caches modules, we
// import once and the mock is swapped per-test around calls.
// ---------------------------------------------------------------------------

const createApproval = (await import("./create_approval.ts")).main;
const addComment = (await import("./add_comment.ts")).main;
const getApproval = (await import("./get_approval.ts")).main;
const listApprovals = (await import("./list_approvals.ts")).main;
const pollDecisions = (await import("./poll_decisions.ts")).main;

// ===========================================================================
// create_approval tests
// ===========================================================================

Deno.test("create_approval: sends POST to correct endpoint", async () => {
  const { captured } = mockFetch({ id: "abc-123", status: "pending" });
  try {
    await createApproval(TEST_GK, "Deploy v2", "high");
    assertEquals(captured.length, 1);
    assertEquals(captured[0].url, "https://api.okrunit.test/api/v1/approvals");
    assertEquals(captured[0].method, "POST");
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: sets source to 'windmill'", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await createApproval(TEST_GK, "Deploy", "medium");
    const body = captured[0].body as Record<string, unknown>;
    assertEquals(body.source, "windmill");
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: idempotency_key matches windmill-{timestamp}-{random} format", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await createApproval(TEST_GK, "Deploy", "low");
    const body = captured[0].body as Record<string, unknown>;
    assertMatch(
      body.idempotency_key as string,
      /^windmill-\d+-[0-9a-f]{8}$/,
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: uses default title when title is empty", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await createApproval(TEST_GK, "", "medium");
    const body = captured[0].body as Record<string, unknown>;
    assertEquals(body.title, "Approval request from windmill");
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: uses default title when title is whitespace-only", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await createApproval(TEST_GK, "   ", "medium");
    const body = captured[0].body as Record<string, unknown>;
    assertEquals(body.title, "Approval request from windmill");
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: trims whitespace from provided title", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await createApproval(TEST_GK, "  My Deploy  ", "high");
    const body = captured[0].body as Record<string, unknown>;
    assertEquals(body.title, "My Deploy");
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: sends Authorization header with Bearer token", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await createApproval(TEST_GK, "Deploy", "low");
    assertEquals(captured[0].headers["authorization"], `Bearer ${TEST_GK.api_key}`);
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: sends Content-Type application/json", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await createApproval(TEST_GK, "Deploy", "low");
    assertEquals(captured[0].headers["content-type"], "application/json");
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: includes optional fields when provided", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await createApproval(
      TEST_GK,
      "Deploy v3",
      "critical",
      "Release notes here",     // description
      "deploy",                  // action_type
      "https://cb.example.com", // callback_url
      { env: "prod" },          // metadata
      "2026-12-31T00:00:00Z",   // expires_at
      2,                         // required_approvals
      "<p>Context</p>",         // context_html
    );
    const body = captured[0].body as Record<string, unknown>;
    assertEquals(body.description, "Release notes here");
    assertEquals(body.action_type, "deploy");
    assertEquals(body.callback_url, "https://cb.example.com");
    assertEquals(body.metadata, { env: "prod" });
    assertEquals(body.expires_at, "2026-12-31T00:00:00Z");
    assertEquals(body.required_approvals, 2);
    assertEquals(body.context_html, "<p>Context</p>");
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: omits optional fields when not provided", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await createApproval(TEST_GK, "Deploy", "medium");
    const body = captured[0].body as Record<string, unknown>;
    assertEquals("description" in body, false);
    assertEquals("action_type" in body, false);
    assertEquals("callback_url" in body, false);
    assertEquals("metadata" in body, false);
    assertEquals("expires_at" in body, false);
    assertEquals("required_approvals" in body, false);
    assertEquals("context_html" in body, false);
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: throws on API error", async () => {
  mockFetch({ error: "Unauthorized" }, 401);
  try {
    await assertRejects(
      () => createApproval(TEST_GK, "Deploy", "high"),
      Error,
      "OKRunit API error (401)",
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("create_approval: returns API response body", async () => {
  const mockResponse = { id: "xyz-789", title: "Deploy", status: "pending" };
  mockFetch(mockResponse);
  try {
    const result = await createApproval(TEST_GK, "Deploy", "high");
    assertEquals(result, mockResponse);
  } finally {
    restoreFetch();
  }
});

// ===========================================================================
// add_comment tests
// ===========================================================================

Deno.test("add_comment: sends POST to correct endpoint with approval ID", async () => {
  const { captured } = mockFetch({ id: "comment-1" });
  try {
    await addComment(TEST_GK, "approval-uuid-123", "Looks good!");
    assertEquals(captured.length, 1);
    assertEquals(
      captured[0].url,
      "https://api.okrunit.test/api/v1/approvals/approval-uuid-123/comments",
    );
    assertEquals(captured[0].method, "POST");
  } finally {
    restoreFetch();
  }
});

Deno.test("add_comment: parameter is 'comment' but request body key is 'body'", async () => {
  const { captured } = mockFetch({ id: "comment-1" });
  try {
    await addComment(TEST_GK, "approval-uuid-123", "My comment text");
    const body = captured[0].body as Record<string, unknown>;
    // The spec requires the request body to use "body" key, not "comment"
    assertEquals(body.body, "My comment text");
    assertEquals("comment" in body, false);
  } finally {
    restoreFetch();
  }
});

Deno.test("add_comment: sends Authorization header", async () => {
  const { captured } = mockFetch({ id: "comment-1" });
  try {
    await addComment(TEST_GK, "approval-uuid-123", "Test");
    assertEquals(captured[0].headers["authorization"], `Bearer ${TEST_GK.api_key}`);
  } finally {
    restoreFetch();
  }
});

Deno.test("add_comment: throws on API error", async () => {
  mockFetch({ error: "Not found" }, 404);
  try {
    await assertRejects(
      () => addComment(TEST_GK, "bad-id", "Comment"),
      Error,
      "OKRunit API error (404)",
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("add_comment: returns API response body", async () => {
  const mockResponse = {
    id: "comment-1",
    approval_id: "approval-uuid-123",
    body: "Looks good!",
    created_by: "user-1",
    created_at: "2026-02-21T10:05:00.000Z",
  };
  mockFetch(mockResponse);
  try {
    const result = await addComment(TEST_GK, "approval-uuid-123", "Looks good!");
    assertEquals(result, mockResponse);
  } finally {
    restoreFetch();
  }
});

// ===========================================================================
// get_approval tests
// ===========================================================================

Deno.test("get_approval: sends GET to correct endpoint", async () => {
  const { captured } = mockFetch({ id: "abc-123", status: "approved" });
  try {
    await getApproval(TEST_GK, "abc-123");
    assertEquals(captured.length, 1);
    assertEquals(
      captured[0].url,
      "https://api.okrunit.test/api/v1/approvals/abc-123",
    );
    assertEquals(captured[0].method, "GET");
  } finally {
    restoreFetch();
  }
});

Deno.test("get_approval: sends Authorization header", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await getApproval(TEST_GK, "abc-123");
    assertEquals(captured[0].headers["authorization"], `Bearer ${TEST_GK.api_key}`);
  } finally {
    restoreFetch();
  }
});

Deno.test("get_approval: does not send Content-Type (GET request)", async () => {
  const { captured } = mockFetch({ id: "abc-123" });
  try {
    await getApproval(TEST_GK, "abc-123");
    assertEquals(captured[0].headers["content-type"], undefined);
  } finally {
    restoreFetch();
  }
});

Deno.test("get_approval: throws on API error", async () => {
  mockFetch({ error: "Not found" }, 404);
  try {
    await assertRejects(
      () => getApproval(TEST_GK, "nonexistent"),
      Error,
      "OKRunit API error (404)",
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("get_approval: returns full approval object", async () => {
  const mockApproval = {
    id: "abc-123",
    title: "Deploy v2.3.1",
    status: "approved",
    priority: "high",
    decided_by: "user-1",
    decided_by_name: "John Doe",
    decided_at: "2026-02-21T10:30:00.000Z",
  };
  mockFetch(mockApproval);
  try {
    const result = await getApproval(TEST_GK, "abc-123");
    assertEquals(result, mockApproval);
  } finally {
    restoreFetch();
  }
});

// ===========================================================================
// list_approvals tests
// ===========================================================================

Deno.test("list_approvals: sends GET to correct endpoint", async () => {
  const { captured } = mockFetch([]);
  try {
    await listApprovals(TEST_GK);
    assertEquals(captured.length, 1);
    assertEquals(captured[0].method, "GET");
    assertStringIncludes(captured[0].url, "https://api.okrunit.test/api/v1/approvals");
  } finally {
    restoreFetch();
  }
});

Deno.test("list_approvals: uses 'limit' parameter (not page_size) with default 25", async () => {
  const { captured } = mockFetch([]);
  try {
    await listApprovals(TEST_GK);
    const url = new URL(captured[0].url);
    assertEquals(url.searchParams.get("limit"), "25");
    assertEquals(url.searchParams.has("page_size"), false);
  } finally {
    restoreFetch();
  }
});

Deno.test("list_approvals: respects custom limit", async () => {
  const { captured } = mockFetch([]);
  try {
    await listApprovals(TEST_GK, undefined, undefined, undefined, 10);
    const url = new URL(captured[0].url);
    assertEquals(url.searchParams.get("limit"), "10");
  } finally {
    restoreFetch();
  }
});

Deno.test("list_approvals: passes status filter", async () => {
  const { captured } = mockFetch([]);
  try {
    await listApprovals(TEST_GK, "pending");
    const url = new URL(captured[0].url);
    assertEquals(url.searchParams.get("status"), "pending");
  } finally {
    restoreFetch();
  }
});

Deno.test("list_approvals: passes priority filter", async () => {
  const { captured } = mockFetch([]);
  try {
    await listApprovals(TEST_GK, undefined, "critical");
    const url = new URL(captured[0].url);
    assertEquals(url.searchParams.get("priority"), "critical");
  } finally {
    restoreFetch();
  }
});

Deno.test("list_approvals: passes search query", async () => {
  const { captured } = mockFetch([]);
  try {
    await listApprovals(TEST_GK, undefined, undefined, "deploy");
    const url = new URL(captured[0].url);
    assertEquals(url.searchParams.get("search"), "deploy");
  } finally {
    restoreFetch();
  }
});

Deno.test("list_approvals: passes all filters together", async () => {
  const { captured } = mockFetch([]);
  try {
    await listApprovals(TEST_GK, "approved", "high", "production", 50);
    const url = new URL(captured[0].url);
    assertEquals(url.searchParams.get("status"), "approved");
    assertEquals(url.searchParams.get("priority"), "high");
    assertEquals(url.searchParams.get("search"), "production");
    assertEquals(url.searchParams.get("limit"), "50");
  } finally {
    restoreFetch();
  }
});

Deno.test("list_approvals: sends Authorization header", async () => {
  const { captured } = mockFetch([]);
  try {
    await listApprovals(TEST_GK);
    assertEquals(captured[0].headers["authorization"], `Bearer ${TEST_GK.api_key}`);
  } finally {
    restoreFetch();
  }
});

Deno.test("list_approvals: throws on API error", async () => {
  mockFetch({ error: "Server error" }, 500);
  try {
    await assertRejects(
      () => listApprovals(TEST_GK),
      Error,
      "OKRunit API error (500)",
    );
  } finally {
    restoreFetch();
  }
});

// ===========================================================================
// poll_decisions tests
// ===========================================================================

Deno.test("poll_decisions: queries both approved and rejected when no status_filter", async () => {
  const { captured } = mockFetch({ data: [] });
  try {
    await pollDecisions(TEST_GK, "2026-01-01T00:00:00Z");
    assertEquals(captured.length, 2);
    const urls = captured.map((c) => new URL(c.url));
    assertEquals(urls[0].searchParams.get("status"), "approved");
    assertEquals(urls[1].searchParams.get("status"), "rejected");
  } finally {
    restoreFetch();
  }
});

Deno.test("poll_decisions: queries only specified status when status_filter is set", async () => {
  const { captured } = mockFetch({ data: [] });
  try {
    await pollDecisions(TEST_GK, "2026-01-01T00:00:00Z", "approved");
    assertEquals(captured.length, 1);
    const url = new URL(captured[0].url);
    assertEquals(url.searchParams.get("status"), "approved");
  } finally {
    restoreFetch();
  }
});

Deno.test("poll_decisions: uses page_size=50 in query params", async () => {
  const { captured } = mockFetch({ data: [] });
  try {
    await pollDecisions(TEST_GK, "2026-01-01T00:00:00Z", "rejected");
    const url = new URL(captured[0].url);
    assertEquals(url.searchParams.get("page_size"), "50");
  } finally {
    restoreFetch();
  }
});

Deno.test("poll_decisions: passes priority_filter when provided", async () => {
  const { captured } = mockFetch({ data: [] });
  try {
    await pollDecisions(TEST_GK, "2026-01-01T00:00:00Z", "approved", "critical");
    const url = new URL(captured[0].url);
    assertEquals(url.searchParams.get("priority"), "critical");
  } finally {
    restoreFetch();
  }
});

Deno.test("poll_decisions: filters results by 'since' timestamp", async () => {
  const mockData = {
    data: [
      { id: "1", title: "Old", status: "approved", priority: "low", decided_by: null, decided_at: "2026-01-01T00:00:00Z", decision_comment: null, metadata: null, created_at: "2025-12-01T00:00:00Z" },
      { id: "2", title: "New", status: "approved", priority: "high", decided_by: "user-1", decided_at: "2026-03-15T10:00:00Z", decision_comment: "OK", metadata: null, created_at: "2026-03-15T09:00:00Z" },
    ],
  };
  mockFetch(mockData);
  try {
    const results = await pollDecisions(TEST_GK, "2026-02-01T00:00:00Z", "approved");
    // Only the "New" approval should be returned (decided_at > since)
    assertEquals(results.length, 1);
    assertEquals(results[0].id, "2");
    assertEquals(results[0].title, "New");
  } finally {
    restoreFetch();
  }
});

Deno.test("poll_decisions: sorts results by decided_at descending", async () => {
  // We need the mock to return different data for the two fetch calls
  // (approved and rejected). Use a counter-based mock.
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = (async () => {
    callCount++;
    const data =
      callCount === 1
        ? {
            data: [
              { id: "a1", title: "Approved Early", status: "approved", priority: "low", decided_by: "u1", decided_at: "2026-03-10T08:00:00Z", decision_comment: null, metadata: null, created_at: "2026-03-10T07:00:00Z" },
            ],
          }
        : {
            data: [
              { id: "r1", title: "Rejected Later", status: "rejected", priority: "high", decided_by: "u2", decided_at: "2026-03-15T12:00:00Z", decision_comment: "No", metadata: null, created_at: "2026-03-15T11:00:00Z" },
            ],
          };
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const results = await pollDecisions(TEST_GK, "2026-03-01T00:00:00Z");
    assertEquals(results.length, 2);
    // Most recent first
    assertEquals(results[0].id, "r1"); // decided 2026-03-15
    assertEquals(results[1].id, "a1"); // decided 2026-03-10
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("poll_decisions: excludes approvals with null decided_at", async () => {
  const mockData = {
    data: [
      { id: "1", title: "Pending-ish", status: "approved", priority: "low", decided_by: null, decided_at: null, decision_comment: null, metadata: null, created_at: "2026-03-01T00:00:00Z" },
    ],
  };
  mockFetch(mockData);
  try {
    const results = await pollDecisions(TEST_GK, "2026-01-01T00:00:00Z", "approved");
    assertEquals(results.length, 0);
  } finally {
    restoreFetch();
  }
});

Deno.test("poll_decisions: sends Authorization header", async () => {
  const { captured } = mockFetch({ data: [] });
  try {
    await pollDecisions(TEST_GK, "2026-01-01T00:00:00Z", "approved");
    assertEquals(captured[0].headers["authorization"], `Bearer ${TEST_GK.api_key}`);
  } finally {
    restoreFetch();
  }
});

Deno.test("poll_decisions: throws on API error", async () => {
  mockFetch({ error: "Forbidden" }, 403);
  try {
    await assertRejects(
      () => pollDecisions(TEST_GK, "2026-01-01T00:00:00Z", "approved"),
      Error,
      "OKRunit API error (403)",
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("poll_decisions: returns empty array when no decisions match since filter", async () => {
  const mockData = {
    data: [
      { id: "1", title: "Old decision", status: "approved", priority: "low", decided_by: "u1", decided_at: "2025-01-01T00:00:00Z", decision_comment: null, metadata: null, created_at: "2025-01-01T00:00:00Z" },
    ],
  };
  mockFetch(mockData);
  try {
    const results = await pollDecisions(TEST_GK, "2026-01-01T00:00:00Z", "approved");
    assertEquals(results.length, 0);
  } finally {
    restoreFetch();
  }
});

// ===========================================================================
// Cross-cutting / spec compliance tests
// ===========================================================================

Deno.test("spec compliance: all scripts use /api/v1/approvals base path", async () => {
  const { captured } = mockFetch({ id: "test", data: [] });
  try {
    await createApproval(TEST_GK, "Test", "low");
    assertStringIncludes(captured[0].url, "/api/v1/approvals");
  } finally {
    restoreFetch();
  }

  const { captured: c2 } = mockFetch({ id: "test" });
  try {
    await getApproval(TEST_GK, "test-id");
    assertStringIncludes(c2[0].url, "/api/v1/approvals/test-id");
  } finally {
    restoreFetch();
  }

  const { captured: c3 } = mockFetch([]);
  try {
    await listApprovals(TEST_GK);
    assertStringIncludes(c3[0].url, "/api/v1/approvals");
  } finally {
    restoreFetch();
  }

  const { captured: c4 } = mockFetch({ id: "c1" });
  try {
    await addComment(TEST_GK, "test-id", "hi");
    assertStringIncludes(c4[0].url, "/api/v1/approvals/test-id/comments");
  } finally {
    restoreFetch();
  }
});

Deno.test("spec compliance: create_approval request body matches spec shape", async () => {
  const { captured } = mockFetch({ id: "abc" });
  try {
    await createApproval(
      TEST_GK,
      "Deploy v2.3.1",
      "high",
      "Release includes new payment flow",
      undefined,
      "https://callback.example.com",
      { key: "value" },
    );
    const body = captured[0].body as Record<string, unknown>;

    // Required fields per spec
    assertEquals(typeof body.title, "string");
    assertEquals(body.source, "windmill");
    assertEquals(typeof body.idempotency_key, "string");

    // Optional fields present
    assertEquals(body.description, "Release includes new payment flow");
    assertEquals(body.callback_url, "https://callback.example.com");
    assertEquals(body.metadata, { key: "value" });
  } finally {
    restoreFetch();
  }
});

Deno.test("spec compliance: error messages include status code", async () => {
  mockFetch({ error: "Bad Request" }, 400);
  try {
    await assertRejects(
      () => createApproval(TEST_GK, "Test", "low"),
      Error,
      "400",
    );
  } finally {
    restoreFetch();
  }

  mockFetch({ error: "Server Error" }, 503);
  try {
    await assertRejects(
      () => getApproval(TEST_GK, "id"),
      Error,
      "503",
    );
  } finally {
    restoreFetch();
  }

  mockFetch({ error: "Forbidden" }, 403);
  try {
    await assertRejects(
      () => addComment(TEST_GK, "id", "text"),
      Error,
      "403",
    );
  } finally {
    restoreFetch();
  }

  mockFetch({ error: "Timeout" }, 504);
  try {
    await assertRejects(
      () => listApprovals(TEST_GK),
      Error,
      "504",
    );
  } finally {
    restoreFetch();
  }
});

Deno.test("spec compliance: idempotency keys are unique across calls", async () => {
  const keys: string[] = [];
  for (let i = 0; i < 5; i++) {
    const { captured } = mockFetch({ id: `id-${i}` });
    try {
      await createApproval(TEST_GK, "Test", "low");
      keys.push((captured[0].body as Record<string, unknown>).idempotency_key as string);
    } finally {
      restoreFetch();
    }
  }
  // All keys should be unique
  const uniqueKeys = new Set(keys);
  assertEquals(uniqueKeys.size, keys.length);
});
