// ---------------------------------------------------------------------------
// OKrunit -- OAuth Grant Type
// ---------------------------------------------------------------------------
// Aggregated view of an active OAuth connection: one entry per OAuth client
// that has at least one non-revoked, non-expired refresh token in the org.
// ---------------------------------------------------------------------------

export interface OAuthGrant {
  /** The OAuth client_id (from oauth_clients table) */
  client_id: string;
  /** Display name of the OAuth application */
  client_name: string;
  /** Logo URL of the OAuth application */
  client_logo_url: string | null;
  /** The org_id this grant belongs to */
  org_id: string;
  /** Scopes that were granted */
  scopes: string[];
  /** When the grant was first created (earliest token created_at) */
  authorized_at: string;
  /** When any token for this grant was last used */
  last_used_at: string | null;
}
