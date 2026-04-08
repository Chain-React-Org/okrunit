// ---------------------------------------------------------------------------
// OKrunit -- Breadcrumb Collector + Request Context
// ---------------------------------------------------------------------------
// Per-request ring buffer of recent actions leading up to an error.
// Uses AsyncLocalStorage for automatic request-scoped context.
//
// Also provides `withRequestContext()` which initializes both the
// breadcrumb store and the correlation ID for a request.
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from "node:async_hooks";
import type { Breadcrumb } from "./types";
import { withCorrelationId } from "./logger";

const MAX_BREADCRUMBS = 10;
const breadcrumbStorage = new AsyncLocalStorage<Breadcrumb[]>();

/** Add a breadcrumb to the current request's trail. */
export function addBreadcrumb(
  crumb: Omit<Breadcrumb, "timestamp">,
): void {
  const store = breadcrumbStorage.getStore();
  if (!store) return; // No active context. Silently skip

  store.push({
    ...crumb,
    timestamp: new Date().toISOString(),
  });

  // Ring buffer: keep only the last N entries
  if (store.length > MAX_BREADCRUMBS) {
    store.splice(0, store.length - MAX_BREADCRUMBS);
  }
}

/** Get all breadcrumbs in the current request context. */
export function getBreadcrumbs(): Breadcrumb[] {
  return breadcrumbStorage.getStore() ?? [];
}

/**
 * Run a function within a fresh breadcrumb context.
 * Used by `withErrorCapture()` to scope breadcrumbs per request.
 */
export function withBreadcrumbContext<T>(fn: () => T): T {
  return breadcrumbStorage.run([], fn);
}

/**
 * Run a function within a full request context: correlation ID + breadcrumbs.
 * Accepts an optional existing correlation ID (e.g. from an X-Correlation-ID
 * header). If none is provided, a new random ID is generated.
 *
 * Usage in API routes:
 *   return withRequestContext(request, () => handleRequest(request));
 */
export function withRequestContext<T>(
  request: Request,
  fn: () => T,
): T {
  const existingId =
    request.headers.get("x-correlation-id") ?? undefined;
  return withCorrelationId(
    () => breadcrumbStorage.run([], fn),
    existingId,
  );
}
