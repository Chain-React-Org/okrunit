// ---------------------------------------------------------------------------
// OKrunit -- OpenAPI Spec Endpoint: GET /api/v1/openapi
// ---------------------------------------------------------------------------
// Returns the generated OpenAPI 3.1 specification as JSON. No authentication
// required so that external tools (Swagger UI, Postman, etc.) can fetch it.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

// Force dynamic so the openapi module isn't evaluated during build.
// extendZodWithOpenApi must run at request time, not at build time,
// because Turbopack's production bundling may not preserve the
// prototype extension.
export const dynamic = "force-dynamic";

export async function GET() {
  const { generateOpenAPISpec } = await import("@/lib/api/openapi");
  const spec = generateOpenAPISpec();

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
