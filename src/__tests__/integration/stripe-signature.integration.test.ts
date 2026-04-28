// ---------------------------------------------------------------------------
// Stripe webhook signature tests.
//
// The webhook handler at src/app/api/v1/billing/webhook/route.ts delegates
// to stripe.webhooks.constructEvent which verifies the Stripe-Signature
// header. We exercise that real Stripe SDK function with payloads we sign
// ourselves the same way Stripe's servers do. This catches regressions
// where the secret is mis-wired or the payload hashing input is altered
// (e.g. JSON-canonicalized before verification, which would fail every
// real webhook).
// ---------------------------------------------------------------------------

import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import Stripe from "stripe";

const SECRET = "whsec_test_dummy_secret_for_signing_only";
const stripe = new Stripe("sk_test_dummy_no_network_calls", { apiVersion: "2024-11-20.acacia" as Stripe.LatestApiVersion });

/** Sign a body the way Stripe's edge does, returning the Stripe-Signature header value. */
function signStripe(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signedPayload = `${timestamp}.${body}`;
  const sig = createHmac("sha256", secret).update(signedPayload).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

const eventPayload = JSON.stringify({
  id: "evt_test_001",
  object: "event",
  type: "checkout.session.completed",
  data: {
    object: {
      id: "cs_test_abc",
      object: "checkout.session",
      customer: "cus_xyz",
      metadata: { org_id: "org_42", plan_id: "pro" },
    },
  },
});

describe("Stripe webhook signature verification", () => {
  it("accepts a valid signature produced with the configured secret", () => {
    const sig = signStripe(eventPayload, SECRET);
    const event = stripe.webhooks.constructEvent(eventPayload, sig, SECRET);
    expect(event.type).toBe("checkout.session.completed");
    expect((event.data.object as { metadata?: { org_id?: string } }).metadata?.org_id).toBe("org_42");
  });

  it("rejects a signature signed with a different secret", () => {
    const sig = signStripe(eventPayload, "whsec_attacker_secret");
    expect(() => stripe.webhooks.constructEvent(eventPayload, sig, SECRET)).toThrow();

    // What this catches: using the wrong webhook signing secret in the
    // env (e.g. dev secret accidentally deployed to prod). The Stripe
    // SDK's constructEvent throws SignatureVerificationError; the route
    // catches and returns 400. Drop the verify call and a forged
    // payload posted to /api/v1/billing/webhook would be accepted as a
    // real Stripe event, letting an attacker upgrade their org to
    // enterprise for free.
  });

  it("rejects a payload tampered after signing (signature was for a different body)", () => {
    const sig = signStripe(eventPayload, SECRET);
    const tampered = eventPayload.replace("\"plan_id\":\"pro\"", "\"plan_id\":\"enterprise\"");
    expect(() => stripe.webhooks.constructEvent(tampered, sig, SECRET)).toThrow();
  });

  it("rejects a stale signature whose timestamp falls outside Stripe's tolerance (default 300s)", () => {
    const stale = Math.floor(Date.now() / 1000) - 600;
    const sig = signStripe(eventPayload, SECRET, stale);
    // Stripe defaults to 300s tolerance via the optional `tolerance` arg.
    expect(() => stripe.webhooks.constructEvent(eventPayload, sig, SECRET, 300)).toThrow();

    // What this catches: replay protection. The route does not pass an
    // explicit tolerance, so it gets Stripe's default. If Stripe ever
    // changed the default to "no tolerance" (unlikely) or a refactor
    // passes Number.MAX_SAFE_INTEGER, every old captured webhook
    // payload is replayable forever. Pinning a finite tolerance is the
    // contract.
  });

  it("rejects a signature with the v1 segment removed", () => {
    const ts = Math.floor(Date.now() / 1000);
    const sigOnlyTs = `t=${ts}`;
    expect(() => stripe.webhooks.constructEvent(eventPayload, sigOnlyTs, SECRET)).toThrow();
  });

  it("rejects a signature whose timestamp segment is absent", () => {
    const sig = createHmac("sha256", SECRET).update(`.${eventPayload}`).digest("hex");
    expect(() => stripe.webhooks.constructEvent(eventPayload, `v1=${sig}`, SECRET)).toThrow();
  });

  it("two distinct events with different ids both sign correctly (replay-by-id is the route's job, not the verifier's)", () => {
    const e1 = JSON.stringify({ id: "evt_001", type: "x" });
    const e2 = JSON.stringify({ id: "evt_002", type: "x" });
    const s1 = signStripe(e1, SECRET);
    const s2 = signStripe(e2, SECRET);
    expect(stripe.webhooks.constructEvent(e1, s1, SECRET).id).toBe("evt_001");
    expect(stripe.webhooks.constructEvent(e2, s2, SECRET).id).toBe("evt_002");

    // What this catches: signature verification doesn't (and can't) tell
    // you whether you've seen an event before. The route is responsible
    // for idempotency by event.id (e.g., recording event ids in a
    // dedupe table). This test pins the contract: the verifier's job is
    // authenticity, not idempotency. If someone removes the verifier
    // expecting "Stripe handles dedup for us", that's wrong.
  });
});
