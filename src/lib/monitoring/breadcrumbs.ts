// ---------------------------------------------------------------------------
// OKrunit -- Breadcrumb Collector
// ---------------------------------------------------------------------------
// Per-request ring buffer of recent actions leading up to an error.
// Uses AsyncLocalStorage for automatic request-scoped context.
// ---------------------------------------------------------------------------

import { AsyncLocalStorage } from "node:async_hooks";
import type { Breadcrumb } from "./types";

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
