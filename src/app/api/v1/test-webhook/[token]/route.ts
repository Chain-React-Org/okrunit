// ---------------------------------------------------------------------------
// OKrunit -- Webhook Test Capture Endpoint
// Public endpoint that captures any HTTP request sent to a test URL.
// No authentication required -- security via unguessable 48-char hex token.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import {
  checkIpRateLimitAsync,
  getClientIp,
  rateLimitResponse,
} from "@/lib/api/ip-rate-limiter";

const MAX_BODY_SIZE = 50_000; // 50 KB

// Public unauthenticated endpoint. Rate limited per IP + per token so a
// leaked 48-char hex token can't be used to flood webhook_test_requests.
const TEST_WEBHOOK_RATE_LIMIT = { limit: 120, windowSeconds: 60 };

async function captureRequest(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  // Rate limit by (ip + token). Single IP can't burst a single token,
  // and a single token can't get burned across many IPs.
  const ip = getClientIp(request);
  const rate = await checkIpRateLimitAsync(
    `test-webhook:${token}:${ip}`,
    TEST_WEBHOOK_RATE_LIMIT,
  );
  if (!rate.allowed) {
    return rateLimitResponse(rate);
  }

  try {
    const admin = createAdminClient();

    // 1. Look up the endpoint by token
    const { data: endpoint, error } = await admin
      .from("webhook_test_endpoints")
      .select("id, org_id")
      .eq("token", token)
      .eq("is_active", true)
      .single();

    if (error || !endpoint) {
      return NextResponse.json(
        { error: "Test endpoint not found" },
        { status: 404 },
      );
    }

    // 2. Parse the request
    const url = new URL(request.url);
    const queryParams: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      queryParams[key] = value;
    });

    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const contentType = request.headers.get("content-type") ?? null;
    let bodyText: string | null = null;
    let bodyJson: Record<string, unknown> | null = null;

    try {
      bodyText = await request.text();
      if (bodyText && bodyText.length > MAX_BODY_SIZE) {
        bodyText = bodyText.slice(0, MAX_BODY_SIZE);
      }
      if (contentType?.includes("application/json") && bodyText) {
        bodyJson = JSON.parse(bodyText);
      }
    } catch {
      // Body parsing failed -- store raw text only
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      null;

    // 3. Store the captured request
    await admin.from("webhook_test_requests").insert({
      endpoint_id: endpoint.id,
      org_id: endpoint.org_id,
      method: request.method,
      url: url.pathname + url.search,
      query_params: queryParams,
      headers,
      body: bodyText,
      body_json: bodyJson,
      content_type: contentType,
      ip_address: ipAddress,
    });

    // 4. Return success
    return NextResponse.json({
      ok: true,
      message: "Request captured by OKrunit Webhook Tester",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("[WebhookTest] Capture error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Export all HTTP method handlers
export const POST = captureRequest;
export const GET = captureRequest;
export const PUT = captureRequest;
export const PATCH = captureRequest;
export const DELETE = captureRequest;
