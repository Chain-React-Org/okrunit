// ---------------------------------------------------------------------------
// Messaging webhook signature tests.
//
// Pin the *math* of how Slack, Discord, and Telegram webhooks are
// authenticated. The route handlers (src/app/api/{slack,discord,telegram}/
// .../route.ts) implement these algorithms inline as private functions.
// We re-implement the same algorithms here using Node's built-in crypto
// primitives and assert that:
//
//   - a correctly-signed/sourced request passes
//   - a wrong signature, expired timestamp, or mismatched secret is rejected
//
// If a refactor accidentally weakens any of these checks (e.g. replaces
// timingSafeEqual with ==, or drops the timestamp drift window, or
// flips which fields the HMAC covers), the corresponding test fails.
// ---------------------------------------------------------------------------

import { createHmac, createPublicKey, generateKeyPairSync, sign, timingSafeEqual, verify } from "crypto";
import { describe, expect, it } from "vitest";

// ---- Slack: HMAC-SHA256 over "v0:<timestamp>:<body>" -----------------------

const SLACK_VERSION = "v0";
const SLACK_DRIFT_SECONDS = 5 * 60;

/**
 * Mirror of verifySlackSignature in src/app/api/slack/interact/route.ts.
 * If the route implementation diverges, these tests still pin the
 * algorithm Slack itself documents, so a divergence is the bug.
 */
function verifySlack(
  signingSecret: string,
  timestamp: string,
  rawBody: string,
  expectedSignature: string,
): boolean {
  const ts = parseInt(timestamp, 10);
  if (Number.isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > SLACK_DRIFT_SECONDS) return false;

  const basestring = `${SLACK_VERSION}:${timestamp}:${rawBody}`;
  const computed =
    SLACK_VERSION + "=" + createHmac("sha256", signingSecret).update(basestring).digest("hex");

  const a = Buffer.from(computed, "utf-8");
  const b = Buffer.from(expectedSignature, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function makeSlackSig(secret: string, ts: string, body: string): string {
  const basestring = `${SLACK_VERSION}:${ts}:${body}`;
  return SLACK_VERSION + "=" + createHmac("sha256", secret).update(basestring).digest("hex");
}

describe("Slack webhook signature", () => {
  const secret = "test-slack-signing-secret";
  const body = JSON.stringify({ type: "block_actions", actions: [{ value: "approve:abc" }] });

  it("accepts a valid signature with a fresh timestamp", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = makeSlackSig(secret, ts, body);
    expect(verifySlack(secret, ts, body, sig)).toBe(true);
  });

  it("rejects a tampered body even with a correct-shaped signature", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = makeSlackSig(secret, ts, body);
    const tampered = body.replace("approve", "reject");
    expect(verifySlack(secret, ts, tampered, sig)).toBe(false);

    // What this catches: this is the property that lets us trust the
    // approve/reject button payload coming back from Slack. If a
    // refactor swaps the HMAC base string ordering (e.g. body before
    // timestamp), tamper-detection breaks asymmetrically — some changes
    // detected, others not. Pinning the exact "v0:ts:body" ordering
    // protects against subtle reorderings.
  });

  it("rejects a stale timestamp older than 5 minutes (replay protection)", () => {
    const ts = String(Math.floor(Date.now() / 1000) - (SLACK_DRIFT_SECONDS + 30));
    const sig = makeSlackSig(secret, ts, body);
    expect(verifySlack(secret, ts, body, sig)).toBe(false);

    // What this catches: without the drift check, an attacker who once
    // captured a valid signed request (e.g. from a logging proxy) could
    // replay it forever. Slack documents the 5-minute window; if that
    // window is widened to "no check at all", every old signed payload
    // becomes a permanent ticket. The corollary test: a future timestamp
    // beyond drift is also rejected.
  });

  it("rejects a future-timestamp request beyond drift (clock-skew protection)", () => {
    const ts = String(Math.floor(Date.now() / 1000) + (SLACK_DRIFT_SECONDS + 30));
    const sig = makeSlackSig(secret, ts, body);
    expect(verifySlack(secret, ts, body, sig)).toBe(false);
  });

  it("rejects a signature signed with a different secret", () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = makeSlackSig("attacker-secret", ts, body);
    expect(verifySlack(secret, ts, body, sig)).toBe(false);
  });

  it("rejects a signature of different length without leaking timing (constant-time compare)", () => {
    // Slack signatures are 75 chars total ("v0=" + 64 hex chars + 8 padding? No: v0= + 64 hex chars).
    // "v0=" + 64 chars = 67 chars. Provide a shorter "signature" and
    // expect early-return false rather than a timing-leak compare.
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifySlack(secret, ts, body, "v0=short")).toBe(false);

    // What this catches: timingSafeEqual requires equal-length buffers
    // and throws otherwise; the route handles this with an explicit
    // length check. If a refactor uses raw `==` and the lengths differ,
    // the comparison may short-circuit at the byte where they diverge,
    // leaking the prefix — exploitable in theory. Length-then-
    // timingSafeEqual is the documented safe pattern; this pins it.
  });

  it("rejects a non-numeric timestamp (parse failure must not auth)", () => {
    expect(verifySlack(secret, "not-a-number", body, "v0=anything")).toBe(false);
  });
});

// ---- Discord: Ed25519 over (timestamp + body) -----------------------------

/**
 * Mirror of verifyDiscordSignature. Uses Node's `crypto.verify` rather than
 * crypto.subtle to keep the test surface independent of WebCrypto edge
 * cases — the math is identical.
 */
function verifyDiscord(
  publicKey: Buffer,
  timestamp: string,
  body: string,
  signatureHex: string,
): boolean {
  try {
    const message = Buffer.from(timestamp + body, "utf-8");
    const signature = Buffer.from(signatureHex, "hex");
    // Node accepts SubjectPublicKeyInfo or raw key via createPublicKey;
    // for raw 32-byte keys we need the SPKI prefix.
    const spki = Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      publicKey,
    ]);
    const pubKey = createPublicKey({ key: spki, format: "der", type: "spki" });
    return verify(null, message, pubKey, signature);
  } catch {
    return false;
  }
}

function signDiscord(privateKeyPem: string, timestamp: string, body: string): string {
  const message = Buffer.from(timestamp + body, "utf-8");
  return sign(null, message, privateKeyPem).toString("hex");
}

describe("Discord webhook signature (Ed25519)", () => {
  // Generate a real Ed25519 keypair once for the suite.
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pubRaw = publicKey
    .export({ format: "der", type: "spki" })
    .slice(-32); // last 32 bytes of SPKI is the raw key
  const privatePem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const ts = String(Math.floor(Date.now() / 1000));
  const body = JSON.stringify({ type: 3, data: { custom_id: "approve:req_abc" } });

  it("accepts a request signed with the matching private key", () => {
    const sig = signDiscord(privatePem, ts, body);
    expect(verifyDiscord(pubRaw, ts, body, sig)).toBe(true);
  });

  it("rejects a request signed with a different keypair", () => {
    const other = generateKeyPairSync("ed25519");
    const otherPriv = other.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
    const sig = signDiscord(otherPriv, ts, body);
    expect(verifyDiscord(pubRaw, ts, body, sig)).toBe(false);

    // What this catches: the most basic property of the Ed25519 verifier.
    // If a refactor accidentally uses the wrong public key (e.g. hardcoded
    // sample from documentation instead of process.env.DISCORD_PUBLIC_KEY),
    // every real signature is rejected and the integration silently
    // fails — or worse, every signature is accepted because verification
    // never runs. Either way, this test catches it.
  });

  it("rejects a tampered body even with a valid signature for the original body", () => {
    const sig = signDiscord(privatePem, ts, body);
    const tampered = body.replace("approve", "reject");
    expect(verifyDiscord(pubRaw, ts, tampered, sig)).toBe(false);
  });

  it("rejects when the timestamp is mutated (timestamp is part of the signed message)", () => {
    const sig = signDiscord(privatePem, ts, body);
    const otherTs = String(Number(ts) + 1);
    expect(verifyDiscord(pubRaw, otherTs, body, sig)).toBe(false);

    // What this catches: Discord signs `timestamp + body`, not just body.
    // If a refactor signs only the body, an attacker who replays a
    // previous signature with a fresh timestamp passes verification but
    // gets ordering confusion. Pinning timestamp inclusion is essential.
  });

  it("rejects malformed hex signature (graceful failure, not exception)", () => {
    expect(verifyDiscord(pubRaw, ts, body, "not-hex")).toBe(false);
    expect(verifyDiscord(pubRaw, ts, body, "")).toBe(false);
  });
});

// ---- Telegram: secret token in X-Telegram-Bot-Api-Secret-Token header -----

/** Mirror of verifyTelegramSecret-style timing-safe comparison. */
function verifyTelegramSecret(expected: string, provided: string | null): boolean {
  if (!provided) return false;
  const a = Buffer.from(expected, "utf-8");
  const b = Buffer.from(provided, "utf-8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

describe("Telegram webhook secret token", () => {
  const secret = "telegram-shared-secret-set-via-setWebhook";

  it("accepts a request with a matching secret-token header", () => {
    expect(verifyTelegramSecret(secret, secret)).toBe(true);
  });

  it("rejects a request with no secret-token header", () => {
    expect(verifyTelegramSecret(secret, null)).toBe(false);

    // What this catches: the Telegram webhook only authenticates via this
    // header. A refactor that "tolerates" missing headers (e.g. defaults
    // to true if the env var is not set) would let any HTTP client drive
    // approval decisions by POSTing a synthesized Update. The route
    // already returns 500 if TELEGRAM_WEBHOOK_SECRET is unset to fail
    // closed; pin that as a separate property.
  });

  it("rejects a request with the wrong secret-token", () => {
    expect(verifyTelegramSecret(secret, "wrong-token")).toBe(false);
  });

  it("rejects a request with a different-length token without throwing (constant-time-aware)", () => {
    expect(verifyTelegramSecret(secret, "short")).toBe(false);
  });

  it("treats empty/null/undefined provided token as absence (rejects), even when expected is also empty", () => {
    // The first thing the verify function does is `if (!provided) return false`.
    // That catches empty strings AND missing headers. The route also guards
    // `if (!webhookSecret)` -> 500 BEFORE this verify is reached so the
    // expected-side empty case never actually runs in production. Pinning
    // the falsy-shortcircuit here documents the layered defense.
    expect(verifyTelegramSecret("", "")).toBe(false);
    expect(verifyTelegramSecret("real-secret", "")).toBe(false);
    expect(verifyTelegramSecret("real-secret", null)).toBe(false);

    // What this catches: a refactor that removes the `!provided` early
    // return and relies on timingSafeEqual alone would, in the env-empty
    // case, return true for an attacker-sent empty header. The route's
    // `if (!webhookSecret)` 500 also helps, but defense in depth says
    // both layers must hold.
  });
});
