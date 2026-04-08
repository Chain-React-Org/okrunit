import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildAccountDeletionEmailHtml } from "@/lib/email/account-deletion";
import { hashApiKey } from "@/lib/api/auth";
import { checkIpRateLimit, getClientIp, AUTH_RATE_LIMIT, rateLimitResponse } from "@/lib/api/ip-rate-limiter";

const FROM_EMAIL = process.env.EMAIL_FROM || "OKrunit <noreply@okrunit.com>";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const DELETION_GRACE_DAYS = 30;

/**
 * POST /api/v1/account/delete
 * Sends a confirmation email with a unique token link.
 * Does NOT delete the account immediately.
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`delete-account:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();

    // Generate a single-use token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate any existing tokens for this user
    await admin
      .from("account_deletion_tokens")
      .delete()
      .eq("user_id", user.id);

    // Create the token
    const { error: tokenError } = await admin
      .from("account_deletion_tokens")
      .insert({
        user_id: user.id,
        token: hashApiKey(token),
        expires_at: expiresAt.toISOString(),
      });

    if (tokenError) {
      console.error("Failed to create deletion token:", tokenError);
      return NextResponse.json(
        { error: "Failed to initiate account deletion" },
        { status: 500 }
      );
    }

    // Send confirmation email
    const confirmUrl = `${APP_URL}/api/v1/account/delete/confirm?token=${token}`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: FROM_EMAIL,
      to: user.email!,
      subject: "Confirm Account Deletion - OKrunit",
      html: buildAccountDeletionEmailHtml({
        confirmLink: confirmUrl,
        graceDays: DELETION_GRACE_DAYS,
      }),
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Account deletion request failed:", err);
    return NextResponse.json(
      { error: "Failed to send confirmation email" },
      { status: 500 }
    );
  }
}
