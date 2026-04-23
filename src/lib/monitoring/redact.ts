// ---------------------------------------------------------------------------
// OKrunit -- Log redaction helper
// ---------------------------------------------------------------------------
// Scrubs sensitive fields from values passed to logger.* calls. Useful
// for OAuth error bodies from providers (Slack/Discord/etc.), which
// occasionally echo back partial tokens, codes, or client secrets in
// their `error_description` text.
// ---------------------------------------------------------------------------

const SENSITIVE_KEYS = new Set([
  "access_token",
  "refresh_token",
  "id_token",
  "bot_token",
  "code",
  "client_secret",
  "secret",
  "authorization",
  "password",
  "otp",
  "token",
  "token_hash",
  "signature",
  "api_key",
]);

/** Max length per string value in the redacted output. */
const MAX_STRING_LEN = 500;

function redactValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[truncated-depth]";
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > MAX_STRING_LEN
      ? value.slice(0, MAX_STRING_LEN) + "…[truncated]"
      : value;
  }
  if (typeof value !== "object") return value;
  if (Array.isArray(value)) {
    return value.map((v) => redactValue(v, depth + 1));
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = redactValue(v, depth + 1);
    }
  }
  return out;
}

/**
 * Redact sensitive fields from an arbitrary log payload. Pass-through
 * for strings and primitives; for objects, redacts any key matching
 * the sensitive key list (case-insensitive).
 */
export function redactForLogging(value: unknown): unknown {
  return redactValue(value);
}
