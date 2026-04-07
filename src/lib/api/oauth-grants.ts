// ---------------------------------------------------------------------------
// OKrunit -- OAuth Grants Query Utility
// ---------------------------------------------------------------------------
// Fetches and aggregates active OAuth grants for an organization. A "grant"
// is an OAuth client that holds at least one non-revoked, non-expired refresh
// token, meaning the external app can still access the org's resources.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import type { OAuthGrant } from "@/lib/types/oauth-grant";

/**
 * Fetch all active OAuth grants for a given organization.
 *
 * The result is aggregated by `client_id`: one entry per connected OAuth app.
 * Sorted by most recently authorized first.
 */
export async function getActiveOAuthGrants(
  orgId: string,
): Promise<OAuthGrant[]> {
  const admin = createAdminClient();

  // 1. Get all non-revoked refresh tokens for this org.
  const { data: refreshTokens } = await admin
    .from("oauth_refresh_tokens")
    .select("client_id, user_id, scopes, created_at, expires_at")
    .eq("org_id", orgId)
    .is("revoked_at", null);

  // Filter to non-expired tokens.
  const now = new Date();
  const activeRefreshTokens = (refreshTokens ?? []).filter(
    (t) => new Date(t.expires_at) > now,
  );

  if (activeRefreshTokens.length === 0) {
    return [];
  }

  // 2. Get last_used_at from active access tokens.
  const { data: accessTokens } = await admin
    .from("oauth_access_tokens")
    .select("client_id, user_id, last_used_at")
    .eq("org_id", orgId)
    .is("revoked_at", null);

  // 3. Look up OAuth client metadata.
  const clientIds = [...new Set(activeRefreshTokens.map((t) => t.client_id))];

  const { data: clients } = await admin
    .from("oauth_clients")
    .select("client_id, name, logo_url")
    .in("client_id", clientIds);

  const clientMap = new Map(
    (clients ?? []).map((c) => [
      c.client_id,
      { name: c.name, logo_url: c.logo_url },
    ]),
  );

  // 4. Aggregate by client_id.
  const grantMap = new Map<string, OAuthGrant>();

  for (const rt of activeRefreshTokens) {
    const key = rt.client_id;
    const existing = grantMap.get(key);
    const client = clientMap.get(rt.client_id);

    if (!existing) {
      grantMap.set(key, {
        client_id: rt.client_id,
        client_name: client?.name ?? "Unknown App",
        client_logo_url: client?.logo_url ?? null,
        org_id: orgId,
        scopes: rt.scopes,
        authorized_at: rt.created_at,
        last_used_at: null,
      });
    } else {
      // Track earliest authorization date.
      if (new Date(rt.created_at) < new Date(existing.authorized_at)) {
        existing.authorized_at = rt.created_at;
      }
    }
  }

  // Merge access token last_used_at data.
  for (const at of accessTokens ?? []) {
    const grant = grantMap.get(at.client_id);
    if (grant && at.last_used_at) {
      if (
        !grant.last_used_at ||
        new Date(at.last_used_at) > new Date(grant.last_used_at)
      ) {
        grant.last_used_at = at.last_used_at;
      }
    }
  }

  // Sort by most recently authorized first.
  return Array.from(grantMap.values()).sort(
    (a, b) =>
      new Date(b.authorized_at).getTime() -
      new Date(a.authorized_at).getTime(),
  );
}
