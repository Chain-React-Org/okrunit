// ---------------------------------------------------------------------------
// OKrunit -- API Error Handling
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { captureError } from "@/lib/monitoring/capture";
import { getCorrelationId } from "@/lib/monitoring/logger";

/**
 * Structured API error with an HTTP status code and optional machine-readable
 * error code. Throw this from any route handler or utility to return a
 * well-formed JSON error response via `errorResponse()`.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string | undefined;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

/**
 * Convert an unknown thrown value into a JSON `NextResponse`.
 *
 * - `ApiError` instances produce their own status code and optional code.
 * - Everything else is treated as an unexpected 500 Internal Server Error.
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: error.issues },
      { status: 400 },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      },
      { status: error.statusCode },
    );
  }

  // Log unexpected errors for observability; never leak internals to clients.
  console.error("[API] Unhandled error:", error);

  // Capture in error monitoring system (fire-and-forget)
  captureError({ error, severity: "error", service: "API" }).catch(() => {});

  const correlationId = getCorrelationId();
  const response = NextResponse.json(
    {
      error: "Internal server error",
      ...(correlationId ? { correlationId } : {}),
    },
    { status: 500 },
  );

  if (correlationId) {
    response.headers.set("x-correlation-id", correlationId);
  }

  return response;
}
