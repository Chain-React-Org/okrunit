// ---------------------------------------------------------------------------
// OKrunit -- API Authentication (Triple: API Key + OAuth + Supabase Session)
// ---------------------------------------------------------------------------

import { createHash, randomBytes } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { API_KEY_LENGTH, API_KEY_PREFIX, LEGACY_API_KEY_PREFIX } from "@/lib/constants";
import { ApiError } from "@/lib/api/errors";
import { addBreadcrumb } from "@/lib/monitoring/breadcrumbs";
import type { Connection, OrgMembership, UserProfile } from "@/lib/types/database";

// ---- Types ----------------------------------------------------------------

export type AuthResult =
  | {
      type: "api_key";
      connection: Connection;
      orgId: string;
    }
  | {
      type: "session";
      user: { id: string; email: string };
      profile: UserProfile;
      membership: OrgMembership;
      orgId: string;
    }
  | {
      type: "oauth";
      tokenId: string;
      clientId: string;
      userId: string;
      orgId: string;
      scopes: string[];
    };

// ---- Key Utilities --------------------------------------------------------

/**
 * Produce a hex-encoded SHA-256 hash of a plaintext API key.
 * Used both when storing keys and when verifying incoming requests.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

/**
 * Generate a fresh API key.
 *
 * @returns An object containing:
 *  - `plaintext` - the full key to hand to the caller (`ok_<64 hex chars>`)
 *  - `hash`      - SHA-256 hex digest (stored in the database)
 *  - `prefix`    - first 8 characters after the prefix (stored for display)
 */
export function generateApiKey(): {
  plaintext: string;
  hash: string;
  prefix: string;
} {
  const raw = randomBytes(API_KEY_LENGTH).toString("hex");
  const plaintext = `${API_KEY_PREFIX}${raw}`;
  const hash = hashApiKey(plaintext);
  const prefix = raw.slice(0, 8);

  return { plaintext, hash, prefix };
}

// ---- Request Authentication -----------------------------------------------

/**
 * Authenticate an incoming API request.
 *
 * 1. If the `Authorization` header carries a Bearer token starting with `ok_`
 *    or `gk_` (legacy), treat it as an API key.
 * 2. If the Bearer token has no recognized prefix, treat it as an OAuth
 *    access token.
 * 3. Otherwise fall back to Supabase cookie-based session authentication.
 * 4. If no method succeeds, throw a 401 `ApiError`.
 */
export async function authenticateRequest(
  request: Request,
): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");

  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7);

    // --- API Key authentication (ok_ or legacy gk_ prefix) -------------------
    if (token.startsWith(API_KEY_PREFIX) || token.startsWith(LEGACY_API_KEY_PREFIX)) {
      addBreadcrumb({ type: "auth", category: "api_key", message: "Authenticating via API key" });
      const result = await authenticateApiKey(token);
      addBreadcrumb({ type: "auth", category: "api_key", message: "Authenticated via API key", data: { orgId: result.orgId } });
      return result;
    }

    // --- OAuth access token (no recognized prefix) --------------------------
    addBreadcrumb({ type: "auth", category: "oauth", message: "Authenticating via OAuth token" });
    const result = await authenticateOAuthToken(token);
    addBreadcrumb({ type: "auth", category: "oauth", message: "Authenticated via OAuth", data: { orgId: result.orgId } });
    return result;
  }

  // --- Supabase session authentication ---------------------------------------
  addBreadcrumb({ type: "auth", category: "session", message: "Authenticating via session cookie" });
  const result = await authenticateSession();
  addBreadcrumb({ type: "auth", category: "session", message: "Authenticated via session", data: { orgId: result.orgId } });
  return result;
}

// ---- Internal Helpers -----------------------------------------------------

async function authenticateApiKey(token: string): Promise<AuthResult> {
  const keyHash = hashApiKey(token);
  const admin = createAdminClient();

  // --- Primary key lookup ---------------------------------------------------
  const { data: connection, error } = await admin
    .from("connections")
    .select("*")
    .eq("api_key_hash", keyHash)
    .single();

  if (connection && !error) {
    if (!connection.is_active) {
      throw new ApiError(403, "API key is inactive", "INACTIVE_API_KEY");
    }

    // Fire-and-forget: update last_used_at so we don't block the request.
    void admin
      .from("connections")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", connection.id);

    return {
      type: "api_key",
      connection: connection as Connection,
      orgId: connection.org_id,
    };
  }

  // --- Fallback: check previous (rotated) key during grace period -----------
  const { data: rotatedConnection, error: rotatedError } = await admin
    .from("connections")
    .select("*")
    .eq("previous_key_hash", keyHash)
    .gt("previous_key_expires_at", new Date().toISOString())
    .single();

  if (rotatedConnection && !rotatedError) {
    if (!rotatedConnection.is_active) {
      throw new ApiError(403, "API key is inactive", "INACTIVE_API_KEY");
    }

    // Fire-and-forget: update last_used_at.
    void admin
      .from("connections")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", rotatedConnection.id);

    // Mark the result so callers / middleware can add a deprecation header.
    const result: AuthResult = {
      type: "api_key",
      connection: rotatedConnection as Connection,
      orgId: rotatedConnection.org_id,
    };

    // Attach a non-enumerable flag for downstream use (e.g. response header).
    Object.defineProperty(result, "_deprecatedKey", {
      value: true,
      enumerable: false,
    });

    return result;
  }

  throw new ApiError(401, "Invalid API key", "INVALID_API_KEY");
}

async function authenticateOAuthToken(token: string): Promise<AuthResult> {
  const tokenHash = hashApiKey(token);
  const admin = createAdminClient();

  const { data: accessToken, error } = await admin
    .from("oauth_access_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .single();

  if (!accessToken || error) {
    throw new ApiError(401, "Invalid access token", "INVALID_TOKEN");
  }

  if (accessToken.revoked_at) {
    throw new ApiError(401, "Access token has been revoked", "TOKEN_REVOKED");
  }

  if (new Date(accessToken.expires_at) < new Date()) {
    throw new ApiError(401, "Access token has expired", "TOKEN_EXPIRED");
  }

  // Fire-and-forget: update last_used_at.
  void admin
    .from("oauth_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", accessToken.id);

  return {
    type: "oauth",
    tokenId: accessToken.id,
    clientId: accessToken.client_id,
    userId: accessToken.user_id,
    orgId: accessToken.org_id,
    scopes: accessToken.scopes,
  };
}

async function authenticateSession(): Promise<AuthResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new ApiError(401, "Authentication required", "UNAUTHENTICATED");
  }

  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("user_profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new ApiError(
      401,
      "User profile not found",
      "PROFILE_NOT_FOUND",
    );
  }

  // Get active org membership (is_default = true)
  const { data: membership, error: membershipError } = await admin
    .from("org_memberships")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .single();

  if (membershipError || !membership) {
    throw new ApiError(
      401,
      "No organization membership found",
      "NO_MEMBERSHIP",
    );
  }

  return {
    type: "session",
    user: { id: user.id, email: user.email! },
    profile: profile as UserProfile,
    membership: membership as OrgMembership,
    orgId: membership.org_id,
  };
}
