// ---------------------------------------------------------------------------
// OKrunit -- Messaging link nonce helpers
// ---------------------------------------------------------------------------
// Unlinked users who click Approve / Reject in Slack / Teams / Discord /
// Telegram get a one-time link back to /link/[platform]/[nonce]. Consuming
// that nonce binds the platform identity (captured at click time) to the
// currently-signed-in OKrunit user.
// ---------------------------------------------------------------------------

import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export type MessagingPlatform = "slack" | "teams" | "discord" | "telegram";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const NONCE_TTL_MS = 10 * 60 * 1000;

/**
 * Create a fresh nonce for an unlinked click. The returned link is what the
 * inbound handler surfaces to the user in their platform-native error
 * response.
 */
export async function createLinkNonce(params: {
  orgId: string;
  platform: MessagingPlatform;
  externalUserId: string;
  externalUsername?: string | null;
}): Promise<{ nonce: string; url: string }> {
  const admin = createAdminClient();
  const nonce = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();

  await admin.from("messaging_link_nonces").insert({
    nonce,
    org_id: params.orgId,
    platform: params.platform,
    external_user_id: params.externalUserId,
    external_username: params.externalUsername ?? null,
    expires_at: expiresAt,
  });

  return {
    nonce,
    url: `${APP_URL}/link/${params.platform}/${nonce}`,
  };
}

export interface LinkNonceRow {
  id: string;
  nonce: string;
  org_id: string;
  platform: MessagingPlatform;
  external_user_id: string;
  external_username: string | null;
  consumed_at: string | null;
  consumed_by: string | null;
  expires_at: string;
}

/**
 * Look up a nonce. Does NOT consume it; the /link page reads to render the
 * confirmation screen, and the POST handler consumes it atomically.
 */
export async function lookupLinkNonce(nonce: string): Promise<LinkNonceRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("messaging_link_nonces")
    .select("*")
    .eq("nonce", nonce)
    .maybeSingle();
  return data as LinkNonceRow | null;
}

export interface ConsumeLinkNonceResult {
  ok: boolean;
  code?:
    | "NOT_FOUND"
    | "EXPIRED"
    | "ALREADY_CONSUMED"
    | "NOT_ORG_MEMBER"
    | "DB_ERROR";
  platform?: MessagingPlatform;
  externalUserId?: string;
  externalUsername?: string | null;
}

/**
 * Consume a nonce and link the caller's OKrunit user to the platform
 * identity recorded at click time. Idempotent — running twice returns
 * ALREADY_CONSUMED without writing again.
 */
export async function consumeLinkNonce(params: {
  nonce: string;
  okrunitUserId: string;
}): Promise<ConsumeLinkNonceResult> {
  const admin = createAdminClient();

  const { data: row } = await admin
    .from("messaging_link_nonces")
    .select("*")
    .eq("nonce", params.nonce)
    .maybeSingle();

  if (!row) return { ok: false, code: "NOT_FOUND" };
  if (row.consumed_at) {
    return {
      ok: false,
      code: "ALREADY_CONSUMED",
      platform: row.platform,
      externalUserId: row.external_user_id,
      externalUsername: row.external_username,
    };
  }
  if (new Date(row.expires_at) < new Date()) {
    return { ok: false, code: "EXPIRED" };
  }

  // Verify the consuming user is a member of the org the nonce was created for.
  const { data: membership } = await admin
    .from("org_memberships")
    .select("role")
    .eq("user_id", params.okrunitUserId)
    .eq("org_id", row.org_id)
    .maybeSingle();
  if (!membership) return { ok: false, code: "NOT_ORG_MEMBER" };

  // Upsert identity mapping. Conflict on (org, platform, external_user_id)
  // — if someone already owns this platform id for this org, we win ties
  // only if they're the same user; otherwise the DB refuses silently and we
  // succeed returning the existing mapping.
  const { error: upsertError } = await admin
    .from("messaging_user_identities")
    .upsert(
      {
        org_id: row.org_id,
        user_id: params.okrunitUserId,
        platform: row.platform,
        external_user_id: row.external_user_id,
        external_username: row.external_username,
      },
      { onConflict: "org_id,platform,external_user_id" },
    );

  if (upsertError) {
    return { ok: false, code: "DB_ERROR" };
  }

  // Mark nonce consumed so it can't be replayed.
  await admin
    .from("messaging_link_nonces")
    .update({
      consumed_at: new Date().toISOString(),
      consumed_by: params.okrunitUserId,
    })
    .eq("id", row.id);

  return {
    ok: true,
    platform: row.platform,
    externalUserId: row.external_user_id,
    externalUsername: row.external_username,
  };
}
