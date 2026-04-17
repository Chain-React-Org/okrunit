// ---------------------------------------------------------------------------
// OKrunit -- OpenAPI Spec Endpoint: GET /api/v1/openapi
// ---------------------------------------------------------------------------
// Returns the generated OpenAPI 3.1 specification as JSON. No authentication
// required so that external tools (Swagger UI, Postman, etc.) can fetch it.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";

import { generateOpenAPISpec } from "@/lib/api/openapi";

export async function GET() {
  const spec = generateOpenAPISpec();

  return NextResponse.json(spec, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
