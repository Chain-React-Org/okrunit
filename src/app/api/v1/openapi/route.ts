// ---------------------------------------------------------------------------
// OKrunit -- OpenAPI Spec Endpoint: GET /api/v1/openapi
// ---------------------------------------------------------------------------
// Returns the generated OpenAPI 3.1 specification as JSON. No authentication
// required so that external tools (Swagger UI, Postman, etc.) can fetch it.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { connection } from "next/server";

export async function GET() {
  // Bail out of static prerendering. This route can only run at request time
  // because extendZodWithOpenApi prototype patching doesn't survive Turbopack
  // bundling during the build phase.
  await connection();

  try {
    const { generateOpenAPISpec } = await import("@/lib/api/openapi");
    const spec = generateOpenAPISpec();

    return NextResponse.json(spec, {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to generate OpenAPI spec", detail: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
