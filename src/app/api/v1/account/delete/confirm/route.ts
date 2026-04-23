import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/api/auth";

const DELETION_GRACE_DAYS = 30;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/v1/account/delete/confirm?token=...
 *
 * Validates the token (read-only) and returns an HTML confirmation
 * page with a form that POSTs back here to actually schedule deletion.
 * Email link-preview scanners, antivirus inliners, and clipboard
 * previewers routinely fetch GET URLs — doing the mutation here would
 * consume the one-time token before the user ever sees it.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/settings?error=invalid_token`);
  }

  const admin = createAdminClient();
  const { data: tokenRecord } = await admin
    .from("account_deletion_tokens")
    .select("id, expires_at, consumed_at")
    .eq("token", hashApiKey(token))
    .is("consumed_at", null)
    .single();

  if (!tokenRecord) {
    return NextResponse.redirect(`${APP_URL}/settings?error=invalid_token`);
  }
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return NextResponse.redirect(`${APP_URL}/settings?error=token_expired`);
  }

  // Token is escaped into an HTML attribute; these are the characters
  // that matter inside a double-quoted attribute value.
  const safeToken = token.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Confirm account deletion — OKrunit</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #fafafa; color: #18181b; margin: 0; padding: 2rem; }
    .card { max-width: 480px; margin: 4rem auto; background: white; border: 1px solid #e4e4e7; border-radius: 12px; padding: 2rem; }
    h1 { font-size: 1.25rem; margin: 0 0 1rem; }
    p { margin: 0 0 1rem; color: #52525b; line-height: 1.5; }
    button { background: #dc2626; color: white; border: 0; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.95rem; }
    button:hover { background: #b91c1c; }
    a { color: #18181b; text-decoration: underline; margin-left: 0.75rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Confirm account deletion</h1>
    <p>You're about to schedule your OKrunit account for deletion. It will be removed in ${DELETION_GRACE_DAYS} days. You can cancel anytime before then from your settings page.</p>
    <p><strong>This action can't be undone once the grace period ends.</strong></p>
    <form method="POST" action="/api/v1/account/delete/confirm">
      <input type="hidden" name="token" value="${safeToken}" />
      <button type="submit">Confirm deletion</button>
      <a href="${APP_URL}/settings">Cancel</a>
    </form>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/**
 * POST /api/v1/account/delete/confirm
 * Consumes the token and schedules the account for deletion.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData().catch(() => null);
  const token = formData?.get("token");

  if (typeof token !== "string" || !token) {
    return NextResponse.redirect(`${APP_URL}/settings?error=invalid_token`, {
      status: 303,
    });
  }

  const admin = createAdminClient();

  const { data: tokenRecord } = await admin
    .from("account_deletion_tokens")
    .select("id, user_id, expires_at, consumed_at")
    .eq("token", hashApiKey(token))
    .is("consumed_at", null)
    .single();

  if (!tokenRecord) {
    return NextResponse.redirect(`${APP_URL}/settings?error=invalid_token`, {
      status: 303,
    });
  }
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return NextResponse.redirect(`${APP_URL}/settings?error=token_expired`, {
      status: 303,
    });
  }

  const { data: consumed } = await admin
    .from("account_deletion_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", tokenRecord.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (!consumed) {
    return NextResponse.redirect(`${APP_URL}/settings?error=invalid_token`, {
      status: 303,
    });
  }

  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_DAYS);

  await admin
    .from("user_profiles")
    .update({
      deletion_scheduled_at: deletionDate.toISOString(),
    })
    .eq("id", tokenRecord.user_id);

  return NextResponse.redirect(`${APP_URL}/settings?deletion_scheduled=true`, {
    status: 303,
  });
}
