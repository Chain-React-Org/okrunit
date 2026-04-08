// ---------------------------------------------------------------------------
// OKrunit -- OAuth 2.0 Token Endpoint
// POST /api/v1/oauth/token
// ---------------------------------------------------------------------------
// Supports three grant types:
//   1. authorization_code - exchange an auth code for access + refresh tokens
//   2. refresh_token      - rotate a refresh token for new tokens
//   3. client_credentials - machine-to-machine (no user context)
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { hashApiKey } from "@/lib/api/auth";
import { logAuditEvent } from "@/lib/api/audit";
import { checkIpRateLimit, getClientIp, AUTH_RATE_LIMIT, rateLimitResponse } from "@/lib/api/ip-rate-limiter";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateOAuthToken,
  accessTokenExpiresAt,
  refreshTokenExpiresAt,
  verifyPkceChallenge,
} from "@/lib/api/oauth";
import {
  OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS,
  OAUTH_REFRESH_GRACE_PERIOD_SECONDS,
} from "@/lib/constants";

// ---- RFC 6749 error response helper ----------------------------------------

function oauthError(
  error: string,
  description: string,
  status = 400,
): NextResponse {
  return NextResponse.json(
    { error, error_description: description },
    { status },
  );
}

// ---- POST /api/v1/oauth/token ----------------------------------------------

export async function POST(request: Request) {
  // Rate limit: 10 requests per minute per IP
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`oauth-token:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    // OAuth token endpoint accepts application/x-www-form-urlencoded or JSON.
    let body: Record<string, string>;
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries()) as Record<string, string>;
    } else {
      body = await request.json();
    }

    const grantType = body.grant_type;

    if (grantType === "authorization_code") {
      return handleAuthorizationCode(body, request);
    }

    if (grantType === "refresh_token") {
      return handleRefreshToken(body, request);
    }

    if (grantType === "client_credentials") {
      return handleClientCredentials(body, request);
    }

    return oauthError(
      "unsupported_grant_type",
      `Grant type "${grantType}" is not supported.`,
    );
  } catch (err) {
    console.error("[OAuth Token] Unhandled error:", err);
    return oauthError("server_error", "An unexpected error occurred.", 500);
  }
}

// ---- Grant: authorization_code --------------------------------------------

async function handleAuthorizationCode(
  body: Record<string, string>,
  request: Request,
): Promise<NextResponse> {
  const { code, redirect_uri, client_id, client_secret, code_verifier } = body;

  if (!code || !redirect_uri || !client_id) {
    return oauthError(
      "invalid_request",
      "Missing required parameters: code, redirect_uri, client_id.",
    );
  }

  const admin = createAdminClient();

  // Look up the client.
  const { data: client } = await admin
    .from("oauth_clients")
    .select("*")
    .eq("client_id", client_id)
    .single();

  if (!client || !client.is_active) {
    return oauthError("invalid_client", "Unknown or inactive client.", 401);
  }

  // Verify client_secret for confidential (org-scoped) clients.
  // Platform clients (org_id is null) are public clients. They skip secret
  // validation and rely on redirect URI validation + authorization code flow.
  const isPlatformClient = client.org_id === null;
  if (client_secret && client_secret !== "not_required") {
    const secretHash = hashApiKey(client_secret);
    if (secretHash !== client.client_secret_hash) {
      return oauthError("invalid_client", "Invalid client secret.", 401);
    }
  } else if (!isPlatformClient) {
    return oauthError("invalid_client", "Client secret is required.", 401);
  }

  // Look up the authorization code.
  const codeHash = hashApiKey(code);
  const { data: authCode } = await admin
    .from("oauth_authorization_codes")
    .select("*")
    .eq("code_hash", codeHash)
    .eq("client_id", client_id)
    .single();

  if (!authCode) {
    return oauthError("invalid_grant", "Invalid authorization code.");
  }

  if (authCode.used_at) {
    return oauthError(
      "invalid_grant",
      "Authorization code has already been used.",
    );
  }

  if (new Date(authCode.expires_at) < new Date()) {
    return oauthError("invalid_grant", "Authorization code has expired.");
  }

  if (authCode.redirect_uri !== redirect_uri) {
    return oauthError("invalid_grant", "Redirect URI mismatch.");
  }

  // Verify PKCE if the code was issued with a challenge.
  // Confidential clients (authenticated via client_secret) can skip PKCE.
  // it's primarily a protection for public clients that can't store secrets.
  if (authCode.code_challenge && code_verifier) {
    if (
      !verifyPkceChallenge(
        code_verifier,
        authCode.code_challenge,
        authCode.code_challenge_method || "plain",
      )
    ) {
      return oauthError("invalid_grant", "PKCE verification failed.");
    }
  } else if (authCode.code_challenge && !code_verifier && !client_secret) {
    // Public clients MUST provide code_verifier when a challenge was issued.
    return oauthError("invalid_grant", "Missing code_verifier for PKCE.");
  } else if (!authCode.code_challenge && !client_secret) {
    // Public clients MUST use PKCE.
    return oauthError(
      "invalid_request",
      "Public clients must use PKCE (code_challenge).",
    );
  }

  // Mark the code as used (atomic, prevents race conditions).
  const { error: updateError } = await admin
    .from("oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", authCode.id)
    .is("used_at", null);

  if (updateError) {
    return oauthError(
      "invalid_grant",
      "Authorization code has already been used.",
    );
  }

  // Generate tokens.
  const accessToken = generateOAuthToken();
  const refreshToken = generateOAuthToken();

  const { data: insertedAccessToken } = await admin
    .from("oauth_access_tokens")
    .insert({
      client_id: client_id,
      user_id: authCode.user_id,
      org_id: authCode.org_id,
      token_hash: accessToken.hash,
      scopes: authCode.scopes,
      expires_at: accessTokenExpiresAt(),
    })
    .select("id")
    .single();

  await admin.from("oauth_refresh_tokens").insert({
    access_token_id: insertedAccessToken?.id ?? null,
    client_id: client_id,
    user_id: authCode.user_id,
    org_id: authCode.org_id,
    token_hash: refreshToken.hash,
    scopes: authCode.scopes,
    expires_at: refreshTokenExpiresAt(),
  });

  // Look up org name for the response.
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", authCode.org_id)
    .single();

  // Look up user email for the response.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", authCode.user_id)
    .single();

  // Audit log.
  const ipAddress =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  await logAuditEvent({
    orgId: authCode.org_id,
    userId: authCode.user_id,
    action: "oauth.token_issued",
    resourceType: "oauth_access_token",
    resourceId: insertedAccessToken?.id,
    details: { client_id, grant_type: "authorization_code" },
    ipAddress,
  });

  return NextResponse.json({
    access_token: accessToken.plaintext,
    token_type: "bearer",
    expires_in: OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS,
    refresh_token: refreshToken.plaintext,
    scope: authCode.scopes.join(" "),
    instance_url: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", ""),
    org_name: org?.name || null,
    user_email: profile?.email || null,
  });
}

// ---- Grant: refresh_token -------------------------------------------------

async function handleRefreshToken(
  body: Record<string, string>,
  request: Request,
): Promise<NextResponse> {
  const { refresh_token, client_id, client_secret } = body;

  if (!refresh_token || !client_id) {
    return oauthError(
      "invalid_request",
      `Missing required parameters: ${[!refresh_token && "refresh_token", !client_id && "client_id"].filter(Boolean).join(", ")}.`,
    );
  }

  const admin = createAdminClient();

  // Verify client.
  const { data: client } = await admin
    .from("oauth_clients")
    .select("*")
    .eq("client_id", client_id)
    .single();

  if (!client || !client.is_active) {
    console.log("[OAuth Refresh] FAIL: client not found or inactive, client_id:", client_id);
    return oauthError("invalid_client", "Unknown or inactive client.", 401);
  }

  if (client_secret) {
    const secretHash = hashApiKey(client_secret);
    if (secretHash !== client.client_secret_hash) {
      console.log("[OAuth Refresh] FAIL: secret mismatch for client:", client_id);
      return oauthError("invalid_client", "Invalid client secret.", 401);
    }
  }

  // Look up the refresh token.
  const tokenHash = hashApiKey(refresh_token);
  const { data: storedToken } = await admin
    .from("oauth_refresh_tokens")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("client_id", client_id)
    .single();

  // Check for grace-period match on a rotated token.
  if (!storedToken) {
    const { data: graceToken } = await admin
      .from("oauth_refresh_tokens")
      .select("*")
      .eq("previous_token_hash", tokenHash)
      .gt("previous_token_expires_at", new Date().toISOString())
      .eq("client_id", client_id)
      .single();

    if (!graceToken) {
      console.log("[OAuth Refresh] FAIL: refresh token not found for client:", client_id);
      return oauthError("invalid_grant", "Invalid refresh token.");
    }

    // Grace period hit. Return the existing new tokens' info.
    // This handles network retries where the client didn't receive the response.
    // For simplicity, generate fresh tokens again.
  }

  const token = storedToken;
  if (!token) {
    return oauthError("invalid_grant", "Invalid refresh token.");
  }

  if (token.revoked_at) {
    return oauthError("invalid_grant", "Refresh token has been revoked.");
  }

  if (token.used_at) {
    // Token reuse detected. Potential token theft. Revoke all tokens for this chain.
    await admin
      .from("oauth_refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", client_id)
      .eq("user_id", token.user_id);

    await admin
      .from("oauth_access_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("client_id", client_id)
      .eq("user_id", token.user_id);

    return oauthError(
      "invalid_grant",
      "Refresh token reuse detected. All tokens revoked for security.",
    );
  }

  if (new Date(token.expires_at) < new Date()) {
    return oauthError("invalid_grant", "Refresh token has expired.");
  }

  // Mark the old refresh token as used and set grace period.
  await admin
    .from("oauth_refresh_tokens")
    .update({
      used_at: new Date().toISOString(),
      previous_token_hash: token.token_hash,
      previous_token_expires_at: new Date(
        Date.now() + OAUTH_REFRESH_GRACE_PERIOD_SECONDS * 1000,
      ).toISOString(),
    })
    .eq("id", token.id);

  // Generate new tokens.
  const newAccessToken = generateOAuthToken();
  const newRefreshToken = generateOAuthToken();

  const { data: insertedAccessToken } = await admin
    .from("oauth_access_tokens")
    .insert({
      client_id: client_id,
      user_id: token.user_id,
      org_id: token.org_id,
      token_hash: newAccessToken.hash,
      scopes: token.scopes,
      expires_at: accessTokenExpiresAt(),
    })
    .select("id")
    .single();

  await admin.from("oauth_refresh_tokens").insert({
    access_token_id: insertedAccessToken?.id ?? null,
    client_id: client_id,
    user_id: token.user_id,
    org_id: token.org_id,
    token_hash: newRefreshToken.hash,
    scopes: token.scopes,
    expires_at: refreshTokenExpiresAt(),
  });

  // Look up org name.
  const { data: org } = await admin
    .from("organizations")
    .select("name")
    .eq("id", token.org_id)
    .single();

  const { data: profile } = await admin
    .from("user_profiles")
    .select("email")
    .eq("id", token.user_id)
    .single();

  const ipAddress =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  await logAuditEvent({
    orgId: token.org_id,
    userId: token.user_id,
    action: "oauth.token_refreshed",
    resourceType: "oauth_access_token",
    resourceId: insertedAccessToken?.id,
    details: { client_id, grant_type: "refresh_token" },
    ipAddress,
  });

  return NextResponse.json({
    access_token: newAccessToken.plaintext,
    token_type: "bearer",
    expires_in: OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS,
    refresh_token: newRefreshToken.plaintext,
    scope: token.scopes.join(" "),
    instance_url: process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(".supabase.co", ""),
    org_name: org?.name || null,
    user_email: profile?.email || null,
  });
}

// ---- Grant: client_credentials --------------------------------------------

async function handleClientCredentials(
  body: Record<string, string>,
  request: Request,
): Promise<NextResponse> {
  const { client_id, client_secret, scope } = body;

  if (!client_id || !client_secret) {
    return oauthError(
      "invalid_request",
      "Missing required parameters: client_id, client_secret.",
    );
  }

  const admin = createAdminClient();

  // Verify client.
  const { data: client } = await admin
    .from("oauth_clients")
    .select("*")
    .eq("client_id", client_id)
    .single();

  if (!client || !client.is_active) {
    return oauthError("invalid_client", "Unknown or inactive client.", 401);
  }

  const secretHash = hashApiKey(client_secret);
  if (secretHash !== client.client_secret_hash) {
    return oauthError("invalid_client", "Invalid client secret.", 401);
  }

  // Resolve scopes.
  const requestedScopes = scope
    ? scope.split(/\s+/).filter(Boolean)
    : client.scopes;
  const grantedScopes = requestedScopes.filter((s: string) =>
    client.scopes.includes(s),
  );

  // Generate access token only (no refresh token for client_credentials).
  const accessToken = generateOAuthToken();

  // For client_credentials, use the client's created_by as the user_id.
  const userId = client.created_by;

  const { data: insertedAccessToken } = await admin
    .from("oauth_access_tokens")
    .insert({
      client_id: client_id,
      user_id: userId,
      org_id: client.org_id,
      token_hash: accessToken.hash,
      scopes: grantedScopes,
      expires_at: accessTokenExpiresAt(),
    })
    .select("id")
    .single();

  const ipAddress =
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";

  await logAuditEvent({
    orgId: client.org_id,
    userId: userId ?? undefined,
    action: "oauth.token_issued",
    resourceType: "oauth_access_token",
    resourceId: insertedAccessToken?.id,
    details: { client_id, grant_type: "client_credentials" },
    ipAddress,
  });

  return NextResponse.json({
    access_token: accessToken.plaintext,
    token_type: "bearer",
    expires_in: OAUTH_ACCESS_TOKEN_EXPIRY_SECONDS,
    scope: grantedScopes.join(" "),
  });
}
