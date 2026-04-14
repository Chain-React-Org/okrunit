import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashApiKey } from "@/lib/api/auth";

const DELETION_GRACE_DAYS = 30;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * GET /api/v1/account/delete/confirm?token=...
 * Validates the token and schedules the account for deletion.
 * Redirects to a confirmation page.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(
      `${APP_URL}/settings?error=invalid_token`
    );
  }

  const admin = createAdminClient();

  // Look up the token
  const { data: tokenRecord } = await admin
    .from("account_deletion_tokens")
    .select("*")
    .eq("token", hashApiKey(token))
    .is("consumed_at", null)
    .single();

  if (!tokenRecord) {
    return NextResponse.redirect(
      `${APP_URL}/settings?error=invalid_token`
    );
  }

  // Check expiration
  if (new Date(tokenRecord.expires_at) < new Date()) {
    return NextResponse.redirect(
      `${APP_URL}/settings?error=token_expired`
    );
  }

  // Mark token as consumed (atomic: only update if still unconsumed)
  const { data: consumed } = await admin
    .from("account_deletion_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", tokenRecord.id)
    .is("consumed_at", null)
    .select("id")
    .maybeSingle();

  if (!consumed) {
    return NextResponse.redirect(
      `${APP_URL}/settings?error=invalid_token`
    );
  }

  // Schedule deletion (soft delete)
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + DELETION_GRACE_DAYS);

  await admin
    .from("user_profiles")
    .update({
      deletion_scheduled_at: deletionDate.toISOString(),
    })
    .eq("id", tokenRecord.user_id);

  return NextResponse.redirect(
    `${APP_URL}/settings?deletion_scheduled=true`
  );
}
