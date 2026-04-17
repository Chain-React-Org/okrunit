// ---------------------------------------------------------------------------
// OKrunit -- OpenAPI Spec Endpoint: GET /api/v1/openapi
// ---------------------------------------------------------------------------
// Returns the generated OpenAPI 3.1 specification as JSON. No authentication
// required so that external tools (Swagger UI, Postman, etc.) can fetch it.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

export async function GET() {
  // Dynamic import so the openapi module (which patches Zod's prototype
  // via extendZodWithOpenApi) is only evaluated at request time, not
  // during Turbopack's production build.
  const { generateOpenAPISpec } = await import("@/lib/api/openapi");
  const spec = generateOpenAPISpec();

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
