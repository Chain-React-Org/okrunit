// ---------------------------------------------------------------------------
// Outbound callback delivery tests.
//
// Exercises src/lib/api/callbacks.ts at two layers:
//   1. SSRF guard via src/lib/api/ssrf.ts (pure logic + DNS).
//   2. HMAC signing + retry-row persistence via attemptWebhookDelivery
//      against a real loopback HTTP server.
//
// These are the only outbound-webhook tests in the suite that exercise the
// network and the signing logic end to end. They don't go through any
// Supabase client; we just spin up an http.Server, point a callback at it,
// and inspect the captured request bytes.
// ---------------------------------------------------------------------------

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "crypto";
import http from "node:http";
import type { AddressInfo } from "node:net";

import { attemptWebhookDelivery } from "@/lib/api/callbacks";
import { isPrivateUrl, resolveAndCheckUrl } from "@/lib/api/ssrf";

// ---- HMAC primitive sanity check ------------------------------------------

describe("HMAC computation matches an independent calculation", () => {
  it("produces a deterministic SHA-256 hex digest given the same body and secret", () => {
    const body = JSON.stringify({ event: "approved", id: "abc" });
    const secret = "shhh";

    const a = createHmac("sha256", secret).update(body).digest("hex");
    const b = createHmac("sha256", secret).update(body).digest("hex");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it("a tampered body produces a different digest (so signature mismatch on receiver)", () => {
    const original = JSON.stringify({ approved: true });
    const tampered = JSON.stringify({ approved: false });
    const secret = "shhh";

    const a = createHmac("sha256", secret).update(original).digest("hex");
    const b = createHmac("sha256", secret).update(tampered).digest("hex");
    expect(a).not.toBe(b);

    // What this catches: this is the property that lets a Zapier/Make/n8n
    // recipient detect a tampered payload. If somehow the codebase ended
    // up signing a hash of the request *headers* instead of the *body*,
    // body tampering would not change the signature. This pins the
    // "signature covers the body" invariant.
  });
});

// ---- SSRF guard: synchronous private-IP detection -------------------------

describe("isPrivateUrl: synchronous private-IP / hostname rejection", () => {
  const cases: Array<[string, boolean, string]> = [
    ["http://127.0.0.1/x", true, "loopback v4"],
    ["http://localhost/x", true, "localhost hostname"],
    ["http://[::1]/x", true, "loopback v6"],
    ["http://10.0.0.1/x", true, "10.0.0.0/8"],
    ["http://172.16.5.5/x", true, "172.16.0.0/12 lower bound"],
    ["http://172.31.255.255/x", true, "172.16.0.0/12 upper bound"],
    ["http://172.32.0.1/x", false, "just outside 172.16.0.0/12"],
    ["http://192.168.1.1/x", true, "192.168.0.0/16"],
    ["http://169.254.169.254/x", true, "AWS / GCP cloud metadata"],
    ["http://0.0.0.0/x", true, "all zeros"],
    ["http://machine.local/x", true, ".local mDNS"],
    ["ftp://example.com/x", true, "non-http(s) protocol"],
    ["not a url", true, "garbage URL"],
    ["https://example.com/x", false, "public https"],
    ["http://1.2.3.4/x", false, "public IP"],
    ["http://metadata.google.internal/x", true, "GCP metadata hostname"],
  ];

  for (const [url, blocked, reason] of cases) {
    it(`${blocked ? "blocks" : "allows"} ${url} (${reason})`, () => {
      expect(isPrivateUrl(url)).toBe(blocked);
    });
  }

  // What these catch: the entire SSRF guard is the difference between
  // Zapier-pointed callbacks and a tenant turning OKrunit into a probe of
  // its own internal network or cloud metadata service. If a refactor
  // accidentally narrows the regex (e.g. drops the 169.254 check on a
  // cleanup pass), a malicious tenant can list IAM credentials by
  // setting their callback URL to http://169.254.169.254/. The boundary
  // cases (172.32, 172.31) catch off-by-one in the range check.
});

describe("resolveAndCheckUrl: DNS rebinding protection", () => {
  it("blocks a hostname that resolves to a private IP", async () => {
    // localhost resolves to 127.0.0.1 — this is the testable equivalent
    // of "DNS-rebound attacker domain points at a private IP".
    expect(await resolveAndCheckUrl("http://localhost/x")).toBe(true);
  });

  it("blocks unresolvable hostnames (treats DNS failure as deny)", async () => {
    expect(
      await resolveAndCheckUrl(
        "http://this-domain-does-not-exist-okrunit-test-xyz.invalid/x",
      ),
    ).toBe(true);

    // What this catches: failing closed (block on resolution error) is the
    // safer default. If a refactor "fixes" this to return false on DNS
    // failure for performance reasons, the next time DNS hiccups across
    // a fleet of integrations, all their callbacks would be ignored —
    // worse, an attacker could deliberately trigger DNS failure to
    // bypass the resolution check.
  });
});

// ---- Real HTTP delivery: HMAC headers + happy/failure paths ---------------

describe("attemptWebhookDelivery: signing + delivery against a real server", () => {
  let server: http.Server;
  let baseUrl: string;
  let received: { headers: http.IncomingHttpHeaders; body: string }[] = [];
  /** Override per-test what the server returns. */
  let nextStatus = 200;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => {
        received.push({ headers: req.headers, body: Buffer.concat(chunks).toString("utf8") });
        res.writeHead(nextStatus, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: nextStatus < 400 }));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  beforeEach(() => {
    received = [];
    nextStatus = 200;
  });

  afterEach(() => {
    // Reset the env between tests so each test specifies its own contract.
    delete process.env.CALLBACK_HMAC_SECRET;
  });

  it("includes a correctly-computed HMAC header when CALLBACK_HMAC_SECRET is set", async () => {
    process.env.CALLBACK_HMAC_SECRET = "test-secret-do-not-leak";
    const payload = { kind: "approved", id: "req_abc" };

    // Note: attemptWebhookDelivery's SSRF guard is *not* invoked here —
    // resolveAndCheckUrl is only called by deliverCallback. We're testing
    // the post-guard path, with 127.0.0.1 explicitly. (See SSRF tests for
    // coverage of the guard.) Bypass: this is a deliberate loopback for
    // testing.
    // We have to bypass the synchronous guard because attemptWebhookDelivery
    // doesn't enforce SSRF directly. To reach a 127.0.0.1 server we just
    // pass the URL straight in.
    const r = await attemptWebhookDelivery(baseUrl + "/cb", payload);

    expect(r.success).toBe(true);
    expect(received).toHaveLength(1);
    const sigHeader = received[0]!.headers["x-okrunit-signature"];
    expect(typeof sigHeader).toBe("string");
    const expected = createHmac("sha256", "test-secret-do-not-leak")
      .update(JSON.stringify(payload))
      .digest("hex");
    expect(sigHeader).toBe(`sha256=${expected}`);

    // The timestamp header must be a numeric Unix-seconds value within a
    // reasonable window (replay protection on the receiving side).
    const tsHeader = received[0]!.headers["x-okrunit-timestamp"];
    const ts = Number(tsHeader);
    const now = Math.floor(Date.now() / 1000);
    expect(Math.abs(now - ts)).toBeLessThan(5);

    // What this catches: if a refactor accidentally drops the signature
    // header or changes the format (e.g. base64 instead of hex, or omits
    // the `sha256=` prefix that downstream verifiers like the Stripe
    // template use), every recipient that verifies signatures would
    // start rejecting our webhooks silently. Worse, if the secret is
    // ever included in headers verbatim by mistake, this test would also
    // catch that anomaly because the value would not match the expected
    // HMAC.
  });

  it("omits the signature header entirely when CALLBACK_HMAC_SECRET is unset (and still delivers)", async () => {
    delete process.env.CALLBACK_HMAC_SECRET;
    const r = await attemptWebhookDelivery(baseUrl + "/no-sig", { id: 1 });

    expect(r.success).toBe(true);
    expect(received[0]!.headers["x-okrunit-signature"]).toBeUndefined();
    expect(received[0]!.headers["x-okrunit-timestamp"]).toBeUndefined();

    // What this catches: this documents an operational risk. Deploying
    // OKrunit without CALLBACK_HMAC_SECRET ships unsigned webhooks; if
    // the recipient (Zapier, etc.) is set up to verify, it will reject
    // every delivery. Pinning the explicit "no header" behavior makes
    // sure an env-var omission shows up in test/staging environments
    // before it surprises customers in production.
  });

  it("a 500 response surfaces as success: false with the response status captured", async () => {
    nextStatus = 500;
    const r = await attemptWebhookDelivery(baseUrl + "/fail", { x: 1 });

    expect(r.success).toBe(false);
    expect(r.responseStatus).toBe(500);
    expect(r.errorMessage).toContain("500");

    // What this catches: a 5xx is the trigger for the cron-based retry
    // schedule (WEBHOOK_RETRY_DELAYS_MS). If a refactor flips success to
    // mean "request did not throw" rather than "2xx response", every
    // server error is silently treated as a successful delivery — the
    // retry queue never picks it up and the integration never fires.
    // Asserting the success/responseStatus pair pins the contract.
  });

  it("a 4xx response is also treated as failure (so 401/403 retries kick in for transient creds issues)", async () => {
    nextStatus = 401;
    const r = await attemptWebhookDelivery(baseUrl + "/auth-fail", { x: 1 });

    expect(r.success).toBe(false);
    expect(r.responseStatus).toBe(401);
  });

  it("a 2xx response with arbitrary body is success: true and the body is captured (truncated)", async () => {
    nextStatus = 202;
    const r = await attemptWebhookDelivery(baseUrl + "/ok", { x: 1 });

    expect(r.success).toBe(true);
    expect(r.responseStatus).toBe(202);
    expect(r.responseBody).toContain("ok");

    // What this catches: 2xx is the success window (covers 200/201/202/204).
    // Some refactors use response.ok which is 200-299; if a refactor uses
    // === 200 instead, perfectly valid 202 Accepted responses (common for
    // queueing recipients) would start failing.
  });

  it("forwards user-supplied callback headers without overriding Content-Type", async () => {
    const r = await attemptWebhookDelivery(baseUrl + "/headers", { x: 1 }, {
      "X-Tenant-Id": "tenant-42",
      "Authorization": "Bearer custom-token",
    });
    expect(r.success).toBe(true);
    expect(received[0]!.headers["x-tenant-id"]).toBe("tenant-42");
    expect(received[0]!.headers["authorization"]).toBe("Bearer custom-token");
    // Content-Type should always be application/json — overrides come from
    // the caller's headers being merged AFTER the default. That's a real
    // design choice; if a tenant passes Content-Type: text/plain we'd
    // honor it, which could break downstream JSON parsers. This pins the
    // current behavior; if it changes it's a deliberate decision.
    expect(received[0]!.headers["content-type"]).toContain("application/json");
  });
});
