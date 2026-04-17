// ---------------------------------------------------------------------------
// OKrunit -- Client-Side Error Capture API: POST
// ---------------------------------------------------------------------------
// Receives error reports from the browser (React error boundary,
// unhandled promise rejections). Rate-limited to prevent abuse.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { z } from "zod";
import { captureError } from "@/lib/monitoring/capture";
import {
  checkIpRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/api/ip-rate-limiter";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/monitoring/logger";

const CAPTURE_RATE_LIMIT = { limit: 10, windowSeconds: 60 };

const clientErrorSchema = z.object({
  message: z.string().max(2000),
  stack: z.string().max(10000).optional(),
  componentStack: z.string().max(5000).optional(),
  url: z.string().max(2000).optional(),
  errorType: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  // Rate limit by IP
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`error-capture:${ip}`, CAPTURE_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const body = await request.json();
    const validated = clientErrorSchema.parse(body);

    // Try to get user context from session (optional, errors can happen pre-auth)
    let userId: string | undefined;
    let orgId: string | undefined;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        userId = user.id;
        // Try to get org context
        const { data: membership } = await supabase
          .from("org_memberships")
          .select("org_id")
          .eq("user_id", user.id)
          .eq("is_default", true)
          .single();
        if (membership) orgId = membership.org_id;
      }
    } catch {
      // Auth context is optional - continue without it
    }

    // Build a synthetic error for fingerprinting
    const syntheticError = new Error(validated.message);
    syntheticError.name = validated.errorType ?? "ClientError";
    // Combine stack + component stack for the full trace
    const fullStack = [
      validated.stack,
      validated.componentStack ? `\nComponent Stack:\n${validated.componentStack}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    if (fullStack) {
      syntheticError.stack = fullStack;
    }

    await captureError({
      error: syntheticError,
      severity: "error",
      service: "Client",
      requestUrl: validated.url,
      userId,
      orgId,
      context: {
        componentStack: validated.componentStack ?? null,
        userAgent: request.headers.get("user-agent"),
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid error report", issues: error.issues },
        { status: 400 },
      );
    }
    logger.error("[ErrorCapture] POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
