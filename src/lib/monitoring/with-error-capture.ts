// ---------------------------------------------------------------------------
// OKrunit -- API Route Error Capture Wrapper
// ---------------------------------------------------------------------------
// Higher-order function that wraps Next.js route handlers with automatic
// error capture. Also initialises a breadcrumb context per request.
//
// Usage:
//   export const GET = withErrorCapture(async (request) => {
//     // ... route logic
//   }, { service: "Connections" });
// ---------------------------------------------------------------------------

import { errorResponse } from "@/lib/api/errors";
import { captureError } from "./capture";
import { addBreadcrumb, withBreadcrumbContext } from "./breadcrumbs";
import { logger } from "./logger";

type RouteHandler = (
  request: Request,
  ctx?: { params: Promise<Record<string, string>> },
) => Promise<Response>;

interface CaptureOptions {
  /** Service name for grouping (e.g. "Connections", "Auth", "Billing") */
  service?: string;
}

/**
 * Wrap a Next.js API route handler with automatic error capture.
 *
 * - Creates a breadcrumb context for the request
 * - Captures unhandled errors with full request context
 * - Still returns the normal error response to the client
 */
export function withErrorCapture(
  handler: RouteHandler,
  options?: CaptureOptions,
): RouteHandler {
  return async (request, ctx) => {
    return withBreadcrumbContext(async () => {
      // Add entry breadcrumb
      addBreadcrumb({
        type: "api",
        category: "request",
        message: `${request.method} ${new URL(request.url).pathname}`,
      });

      const start = performance.now();
      const pathname = new URL(request.url).pathname;

      try {
        const response = await handler(request, ctx);
        const duration_ms = Math.round(performance.now() - start);
        if (duration_ms > 100) {
          logger.perf("API request", {
            service: options?.service,
            request_method: request.method,
            request_url: pathname,
            status_code: response.status,
            duration_ms,
          });
        }
        return response;
      } catch (error) {
        // Capture the error in our monitoring system
        captureError({
          error,
          service: options?.service,
          requestUrl: request.url,
          requestMethod: request.method,
        }).catch(() => {
          // Swallow. Monitoring must never affect the response
        });

        // Return the standard error response to the client
        return errorResponse(error);
      }
    });
  };
}
