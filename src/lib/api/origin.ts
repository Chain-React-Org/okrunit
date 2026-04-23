// ---------------------------------------------------------------------------
// OKrunit -- Same-origin check helper
// ---------------------------------------------------------------------------
// Defense-in-depth against CSRF for cookie-authed POST endpoints that
// don't otherwise have a CSRF token. Supabase session cookies are
// SameSite=lax which already blocks most cross-site POSTs, but a few
// browsers (older Safari, embedded webviews) have quirks; requiring
// Origin === APP_URL closes that window.
// ---------------------------------------------------------------------------

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Returns true when the request's Origin (or Referer fallback) matches
 * the configured APP_URL. Missing Origin/Referer is treated as trusted
 * ONLY for GET requests — cookie-authed POSTs without an Origin are
 * rejected.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).origin === new URL(APP_URL).origin;
    } catch {
      return false;
    }
  }
  const referer = request.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin === new URL(APP_URL).origin;
    } catch {
      return false;
    }
  }
  return false;
}
