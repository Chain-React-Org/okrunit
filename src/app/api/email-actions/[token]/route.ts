// ---------------------------------------------------------------------------
// OKrunit -- Email Action Route (One-Click Approve/Reject from Email)
// ---------------------------------------------------------------------------
//
// This route handles email action links. When a user clicks "Approve" or
// "Reject" in a notification email, they land on the GET handler which shows
// a confirmation page. The user then clicks a button which triggers a POST
// to actually perform the action. This two-step flow prevents email client
// link previews from accidentally triggering approvals.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { validateAndConsumeToken } from "@/lib/notifications/tokens";
import { logAuditEvent } from "@/lib/api/audit";
import { getClientIp, checkIpRateLimit, rateLimitResponse, AUTH_RATE_LIMIT } from "@/lib/api/ip-rate-limiter";
import { deliverCallback } from "@/lib/api/callbacks";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/** Return a self-contained HTML page (no external dependencies). */
function htmlPage(
  title: string,
  heading: string,
  message: string,
  variant: "success" | "error" | "info",
): Response {
  const colors = {
    success: { bg: "#f0fdf4", border: "#16a34a", text: "#15803d" },
    error: { bg: "#fef2f2", border: "#dc2626", text: "#b91c1c" },
    info: { bg: "#eff6ff", border: "#2563eb", text: "#1d4ed8" },
  };

  const c = colors[variant];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>${title} - OKrunit</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
    .card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:480px;width:100%;overflow:hidden}
    .header{background:#1e293b;padding:20px 24px}
    .header h1{color:#fff;font-size:18px;font-weight:600}
    .body{padding:32px 24px}
    .alert{padding:16px;border-radius:8px;border-left:4px solid ${c.border};background:${c.bg};margin-bottom:24px}
    .alert h2{color:${c.text};font-size:16px;margin-bottom:4px}
    .alert p{color:#4b5563;font-size:14px}
    .link{display:inline-block;padding:10px 20px;background:#1e293b;color:#fff;text-decoration:none;border-radius:6px;font-size:14px;font-weight:500}
    .link:hover{background:#334155}
    .center{text-align:center}
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><h1>OKrunit</h1></div>
    <div class="body">
      <div class="alert">
        <h2>${heading}</h2>
        <p>${message}</p>
      </div>
      <div class="center">
        <a href="${APP_URL}/dashboard" class="link">Go to Dashboard</a>
      </div>
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** Return a confirmation page with a button that POSTs to perform the action. */
function confirmationPage(
  token: string,
  action: "approve" | "reject",
  requestTitle: string,
): Response {
  const actionLabel = action === "approve" ? "Approve" : "Reject";
  const actionColor = action === "approve" ? "#16a34a" : "#dc2626";
  const actionBg = action === "approve" ? "#f0fdf4" : "#fef2f2";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Confirm ${actionLabel} - OKrunit</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
    .card{background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);max-width:480px;width:100%;overflow:hidden}
    .header{background:#1e293b;padding:20px 24px}
    .header h1{color:#fff;font-size:18px;font-weight:600}
    .body{padding:32px 24px}
    .info{padding:16px;border-radius:8px;border-left:4px solid ${actionColor};background:${actionBg};margin-bottom:24px}
    .info h2{color:#1e293b;font-size:16px;margin-bottom:4px}
    .info p{color:#4b5563;font-size:14px}
    .btn{display:inline-block;padding:12px 28px;background:${actionColor};color:#fff;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;width:100%}
    .btn:hover{opacity:0.9}
    .btn:disabled{opacity:0.5;cursor:not-allowed}
    .cancel{display:block;text-align:center;margin-top:12px;color:#6b7280;font-size:13px;text-decoration:none}
    .cancel:hover{color:#374151}
  </style>
</head>
<body>
  <div class="card">
    <div class="header"><h1>OKrunit</h1></div>
    <div class="body">
      <div class="info">
        <h2>Confirm: ${actionLabel} Request</h2>
        <p>"${requestTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}"</p>
      </div>
      <form method="POST" id="actionForm">
        <button type="submit" class="btn" id="submitBtn">${actionLabel} this request</button>
      </form>
      <a href="${APP_URL}/dashboard" class="cancel">Cancel and go to Dashboard</a>
    </div>
  </div>
  <noscript></noscript>
</body>
</html>`;

  // Generate a nonce-based CSP for this standalone HTML page so the
  // inline button-disable script can run without 'unsafe-inline'.
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const htmlWithScript = html.replace(
    "<noscript></noscript>",
    `<script nonce="${nonce}">document.getElementById('actionForm').addEventListener('submit',function(){var b=document.getElementById('submitBtn');b.disabled=true;b.textContent='Processing...'});</script>`,
  );

  return new Response(htmlWithScript, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'`,
    },
  });
}

// ---------------------------------------------------------------------------
// GET /api/email-actions/[token]
// Shows a confirmation page. Does NOT perform the action.
// ---------------------------------------------------------------------------

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`email-action:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { token } = await params;

  // Peek at the token without consuming it to show the confirmation page.
  const admin = createAdminClient();
  const { hashApiKey } = await import("@/lib/api/auth");
  const tokenHash = hashApiKey(token);

  const { data: row } = await admin
    .from("email_action_tokens")
    .select("request_id, action, consumed_at, expires_at")
    .eq("token", tokenHash)
    .maybeSingle();

  if (!row) {
    return htmlPage(
      "Invalid Link",
      "This link is no longer valid",
      "The link may have expired, already been used, or is invalid. Please check your dashboard for the current status of the request.",
      "error",
    );
  }

  if (row.consumed_at) {
    return htmlPage(
      "Already Used",
      "This link has already been used",
      "This action has already been processed. Please check your dashboard for the current status.",
      "info",
    );
  }

  if (new Date(row.expires_at) < new Date()) {
    return htmlPage(
      "Link Expired",
      "This link has expired",
      "The action link has passed its expiration time. Please check your dashboard.",
      "info",
    );
  }

  // Fetch the request title for the confirmation page.
  const { data: approval } = await admin
    .from("approval_requests")
    .select("title, status")
    .eq("id", row.request_id)
    .single();

  if (!approval || approval.status !== "pending") {
    const statusLabel = approval?.status
      ? approval.status.charAt(0).toUpperCase() + approval.status.slice(1)
      : "Unknown";
    return htmlPage(
      "Already Decided",
      `Request already ${statusLabel.toLowerCase()}`,
      "This approval request has already been processed. No further action is needed.",
      "info",
    );
  }

  return confirmationPage(
    token,
    row.action as "approve" | "reject",
    approval.title || "Untitled Request",
  );
}

// ---------------------------------------------------------------------------
// POST /api/email-actions/[token]
// Actually performs the approve/reject action.
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const ip = getClientIp(request);
  const rl = checkIpRateLimit(`email-action:${ip}`, AUTH_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl);

  const { token } = await params;

  // 1. Validate and consume the token (single-use).
  const action = await validateAndConsumeToken(token);

  if (!action) {
    return htmlPage(
      "Invalid Link",
      "This link is no longer valid",
      "The link may have expired, already been used, or is invalid. Please check your dashboard for the current status of the request.",
      "error",
    );
  }

  const admin = createAdminClient();

  // 2. Fetch the approval request.
  const { data: approval, error: fetchError } = await admin
    .from("approval_requests")
    .select("*")
    .eq("id", action.requestId)
    .single();

  if (fetchError || !approval) {
    return htmlPage(
      "Request Not Found",
      "Approval request not found",
      "The approval request associated with this link could not be found. It may have been deleted.",
      "error",
    );
  }

  // 3. Check that the request is still pending.
  if (approval.status !== "pending") {
    const statusLabel =
      approval.status.charAt(0).toUpperCase() + approval.status.slice(1);

    return htmlPage(
      "Already Decided",
      `Request already ${statusLabel.toLowerCase()}`,
      `This approval request has already been ${statusLabel.toLowerCase()}. No further action is needed.`,
      "info",
    );
  }

  // 4. Check for lazy expiration.
  if (approval.expires_at && new Date(approval.expires_at) < new Date()) {
    await admin
      .from("approval_requests")
      .update({ status: "expired" })
      .eq("id", approval.id);

    return htmlPage(
      "Request Expired",
      "This request has expired",
      "The approval request has passed its expiration time and can no longer be actioned.",
      "info",
    );
  }

  // 4b. Check approval permission for the user.
  const { data: membership } = await admin
    .from("org_memberships")
    .select("can_approve")
    .eq("user_id", action.userId)
    .eq("org_id", approval.org_id)
    .maybeSingle();

  if (!membership?.can_approve) {
    return htmlPage(
      "Permission Denied",
      "You do not have approval permissions",
      "Your account does not have permission to approve or reject requests. Please contact your organization admin.",
      "error",
    );
  }

  // 5. Apply the decision.
  const newStatus = action.action === "approve" ? "approved" : "rejected";
  const decidedAt = new Date().toISOString();

  const { data: updated, error: updateError } = await admin
    .from("approval_requests")
    .update({
      status: newStatus,
      decided_by: action.userId,
      decided_at: decidedAt,
      decision_source: "email",
    })
    .eq("id", approval.id)
    .select("*")
    .single();

  if (updateError || !updated) {
    console.error("[EmailAction] Failed to update approval request:", updateError);
    return htmlPage(
      "Error",
      "Failed to process your action",
      "An unexpected error occurred while processing your decision. Please try again from the dashboard.",
      "error",
    );
  }

  // 6. Audit log (fire-and-forget).
  logAuditEvent({
    orgId: approval.org_id,
    userId: action.userId,
    action: `approval.${newStatus}`,
    resourceType: "approval_request",
    resourceId: approval.id,
    details: {
      decision: action.action,
      decision_source: "email",
    },
    ipAddress: getClientIp(request),
  });

  // 7. Deliver callback if configured (fire-and-forget).
  if (approval.callback_url) {
    deliverCallback({
      requestId: approval.id,
      connectionId: approval.connection_id,
      callbackUrl: approval.callback_url,
      callbackHeaders:
        (approval.callback_headers as Record<string, string>) ?? undefined,
      payload: {
        id: updated.id,
        status: updated.status,
        decided_by: updated.decided_by,
        decided_at: updated.decided_at,
        decision_comment: updated.decision_comment,
        title: updated.title,
        priority: updated.priority,
        metadata: updated.metadata,
      },
    });
  }

  // 8. Return success page.
  const actionLabel = action.action === "approve" ? "Approved" : "Rejected";

  return htmlPage(
    `Request ${actionLabel}`,
    `Request ${actionLabel}`,
    `You have successfully ${actionLabel.toLowerCase()} the request "${(approval.title ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")}".`,
    "success",
  );
}
