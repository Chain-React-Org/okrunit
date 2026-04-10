// ---------------------------------------------------------------------------
// OKrunit -- Onboarding Tutorial API
// ---------------------------------------------------------------------------
// POST: Create test approval request for onboarding walkthrough
// DELETE: Clean up all test data created during onboarding
// ---------------------------------------------------------------------------

import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api/auth";
import { ApiError, errorResponse } from "@/lib/api/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { CacheTags, revalidateTags } from "@/lib/cache/tags";

const TEST_TITLE = "Test: Deploy marketing site update";
const TEST_DESCRIPTION = "This is a sample approval request created during onboarding. You can approve or reject it to see how the flow works. It will be cleaned up when you finish the tutorial.";

// POST: Create test approval request or test flow
export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") throw new ApiError(403, "Session required");

    const url = new URL(request.url);
    const type = url.searchParams.get("type") ?? "request";

    const admin = createAdminClient();

    if (type === "flow") {
      return await createTestFlow(admin, auth.orgId);
    }

    // Check if test request already exists
    const { data: existing } = await admin
      .from("approval_requests")
      .select("id")
      .eq("org_id", auth.orgId)
      .eq("source", "onboarding")
      .eq("status", "pending")
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json({ data: existing[0], existing: true });
    }

    // Create the test request
    const { data, error } = await admin
      .from("approval_requests")
      .insert({
        org_id: auth.orgId,
        title: TEST_TITLE,
        description: TEST_DESCRIPTION,
        action_type: "deploy",
        priority: "medium",
        status: "pending",
        source: "onboarding",
        required_approvals: 1,
        created_by: {
          type: "session",
          user_id: auth.user.id,
          connection_name: "Onboarding Tutorial",
        },
        metadata: { onboarding: true },
        context_html: `
          <div style="font-family: system-ui, sans-serif;">
            <h3>Marketing Site Update</h3>
            <p>This deploy will update the landing page copy and add new testimonials.</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 12px;">
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px; font-weight: 600;">Environment</td>
                <td style="padding: 8px;">Production</td>
              </tr>
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 8px; font-weight: 600;">Branch</td>
                <td style="padding: 8px; font-family: monospace;">main</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: 600;">Changes</td>
                <td style="padding: 8px;">3 files changed, 47 insertions</td>
              </tr>
            </table>
          </div>
        `,
      })
      .select("id")
      .single();

    if (error || !data) {
      throw new ApiError(500, "Failed to create test request");
    }

    return NextResponse.json({ data, existing: false }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

// DELETE: Clean up onboarding test data
export async function DELETE(request: Request) {
  try {
    const auth = await authenticateRequest(request);
    if (auth.type !== "session") throw new ApiError(403, "Session required");

    const url = new URL(request.url);
    const type = url.searchParams.get("type");

    const admin = createAdminClient();

    if (type === "flow") {
      await admin
        .from("approval_flows")
        .delete()
        .eq("org_id", auth.orgId)
        .eq("source", "onboarding");
      revalidateTags(CacheTags.routes(auth.orgId));
      return NextResponse.json({ success: true });
    }

    // Delete all onboarding test requests (any status)
    await admin
      .from("approval_requests")
      .delete()
      .eq("org_id", auth.orgId)
      .eq("source", "onboarding");

    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createTestFlow(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
) {
  // Check if a test flow already exists
  const { data: existing } = await admin
    .from("approval_flows")
    .select("id")
    .eq("org_id", orgId)
    .eq("source", "onboarding")
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ data: existing[0], existing: true });
  }

  const { data, error } = await admin
    .from("approval_flows")
    .insert({
      org_id: orgId,
      source: "onboarding",
      source_id: "onboarding-test-flow",
      name: "Example: Deploy Approval Workflow",
      is_configured: false,
      default_priority: "medium",
      default_required_approvals: 1,
      approver_mode: "any",
      is_sequential: false,
      request_count: 3,
      last_request_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new ApiError(500, "Failed to create test flow");
  }

  revalidateTags(CacheTags.routes(orgId));
  return NextResponse.json({ data, existing: false }, { status: 201 });
}
