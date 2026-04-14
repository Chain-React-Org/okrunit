// ---------------------------------------------------------------------------
// OKrunit -- OAuth 2.0 Utilities
// ---------------------------------------------------------------------------

import { createHash, randomBytes, randomUUID } from "crypto";

import { hashApiKey } from "@/lib/api/auth";
import {
  OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS,
  OAUTH_AUTH_CODE_EXPIRY_SECONDS,
  OAUTH_REFRESH_TOKEN_EXPIRY_SECONDS,
  OAUTH_SCOPES,
} from "@/lib/constants";

// ---- Token Generation ----------------------------------------------------

/**
 * Generate an opaque OAuth token (access token, refresh token, or auth code).
 * Returns both the plaintext (given to the client) and its SHA-256 hash
 * (stored in the database). Tokens have no prefix; they are distinguished
 * from API keys by the absence of the `ok_` / `gk_` prefix.
 */
export function generateOAuthToken(): { plaintext: string; hash: string } {
  const plaintext = randomBytes(32).toString("hex");
  const hash = hashApiKey(plaintext);
  return { plaintext, hash };
}

/**
 * Generate credentials for a new OAuth client.
 */
export function generateClientCredentials(): {
  clientId: string;
  clientSecret: string;
  clientSecretHash: string;
  clientSecretPrefix: string;
} {
  const clientId = randomUUID();
  const clientSecret = `gks_${randomBytes(32).toString("hex")}`;
  const clientSecretHash = hashApiKey(clientSecret);
  const clientSecretPrefix = clientSecret.slice(4, 12);
  return { clientId, clientSecret, clientSecretHash, clientSecretPrefix };
}

// ---- Scope Validation ----------------------------------------------------

/**
 * Check that all requested scopes are valid.
 */
export function validateScopes(requested: string[]): boolean {
  return requested.every((s) =>
    (OAUTH_SCOPES as readonly string[]).includes(s),
  );
}

/**
 * Parse a space-separated scope string into an array.
 */
export function parseScopes(scopeString: string | undefined): string[] {
  if (!scopeString || !scopeString.trim()) {
    return [...OAUTH_SCOPES];
  }
  return scopeString.split(/\s+/).filter(Boolean);
}

/**
 * Intersect requested scopes with the client's allowed scopes.
 */
export function resolveScopes(
  requested: string[],
  clientAllowed: string[],
): string[] {
  return requested.filter((s) => clientAllowed.includes(s));
}

// ---- PKCE ----------------------------------------------------------------

/**
 * Verify a PKCE code verifier against a stored code challenge.
 *
 * Supports `S256` (SHA-256 of the verifier, base64url-encoded) and `plain`
 * (direct string comparison). Returns `true` if the verifier matches.
 */
export function verifyPkceChallenge(
  verifier: string,
  challenge: string,
  method: string,
): boolean {
  if (method === "S256") {
    const hash = createHash("sha256").update(verifier).digest("base64url");
    return hash === challenge;
  }

  // "plain" method rejected for security - S256 required
  return false;
}

// ---- Expiry Helpers ------------------------------------------------------

/**
 * Compute an ISO timestamp `seconds` in the future from now.
 */
export function expiresAt(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/** Get the expiry timestamp for an access token. */
export function accessTokenExpiresAt(): string {
  return expiresAt(OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS);
}

/** Get the expiry timestamp for a refresh token. */
export function refreshTokenExpiresAt(): string {
  return expiresAt(OAUTH_REFRESH_TOKEN_EXPIRY_SECONDS);
}

/** Get the expiry timestamp for an authorization code. */
export function authCodeExpiresAt(): string {
  return expiresAt(OAUTH_AUTH_CODE_EXPIRY_SECONDS);
}
