// ---------------------------------------------------------------------------
// OKrunit -- GitHub Callback Handler
//
// Receives OKrunit's own callback when an approval decision is made on a
// GitHub-sourced approval request. Updates the GitHub check run accordingly.
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { createHmac } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import { createCheckRun } from "@/lib/api/github";
import { logger } from "@/lib/monitoring/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CallbackPayload {
  id: string;
  status: "approved" | "rejected" | "cancelled" | "expired";
  decided_by: string | null;
  decided_at: string | null;
  decision_comment: string | null;
  title: string;
  priority: string;
  metadata: {
    repo: string;
    pr_number: number;
    pr_url: string;
    author: string;
    head_sha: string;
    base_branch: string;
    installation_id: number;
    [key: string]: unknown;
  };
}

// ---------------------------------------------------------------------------
// POST /api/github/callback
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    // 1. Verify the HMAC signature from OKrunit's callback delivery
    const rawBody = await request.text();
    const hmacSecret = process.env.CALLBACK_HMAC_SECRET;

    if (hmacSecret) {
      const signature = request.headers.get("x-okrunit-signature");
      if (!signature) {
        return NextResponse.json(
          { error: "Missing callback signature" },
          { status: 401 },
        );
      }
      const expected = `sha256=${createHmac("sha256", hmacSecret).update(rawBody).digest("hex")}`;
      if (signature !== expected) {
        return NextResponse.json(
          { error: "Invalid callback signature" },
          { status: 401 },
        );
      }
    }

    // 2. Parse the callback payload
    const payload = JSON.parse(rawBody) as CallbackPayload;
    const { id, status, decision_comment, metadata } = payload;

    if (!metadata?.repo || !metadata?.head_sha || !metadata?.installation_id) {
      return NextResponse.json(
        { error: "Missing required metadata fields (repo, head_sha, installation_id)" },
        { status: 400 },
      );
    }

    // 3. Look up the decided_by user name for the check run summary
    let decidedByName = "Unknown";
    if (payload.decided_by) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("user_profiles")
        .select("full_name, email")
        .eq("id", payload.decided_by)
        .single();

      if (profile) {
        decidedByName = profile.full_name || profile.email;
      }
    }

    // 4. Map approval status to GitHub check run conclusion
    let conclusion: "success" | "failure" | "cancelled" | "stale";
    let title: string;
    let summary: string;

    switch (status) {
      case "approved":
        conclusion = "success";
        title = "Approved";
        summary = `**Approved** by ${decidedByName}`;
        if (decision_comment) {
          summary += `\n\n> ${decision_comment}`;
        }
        break;

      case "rejected":
        conclusion = "failure";
        title = "Rejected";
        summary = `**Rejected** by ${decidedByName}`;
        if (decision_comment) {
          summary += `\n\nReason: ${decision_comment}`;
        }
        break;

      case "cancelled":
        conclusion = "cancelled";
        title = "Cancelled";
        summary = "The approval request was cancelled.";
        if (decision_comment) {
          summary += `\n\n${decision_comment}`;
        }
        break;

      case "expired":
        conclusion = "stale";
        title = "Expired";
        summary = "The approval request expired before a decision was made.";
        break;

      default:
        return NextResponse.json(
          { error: `Unhandled approval status: ${status}` },
          { status: 400 },
        );
    }

    // 5. Update the GitHub check run
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://okrunit.com";

    await createCheckRun({
      installationId: metadata.installation_id,
      repo: metadata.repo,
      sha: metadata.head_sha,
      status: "completed",
      conclusion,
      details: {
        title,
        summary,
        details_url: `${appUrl}/dashboard?approval=${id}`,
      },
    });

    return NextResponse.json(
      { message: "Check run updated", approval_id: id, conclusion },
      { status: 200 },
    );
  } catch (error) {
    logger.error("[GitHub Callback] Error:", error);
    return NextResponse.json(
      { error: "Failed to update GitHub check run" },
      { status: 500 },
    );
  }
}
