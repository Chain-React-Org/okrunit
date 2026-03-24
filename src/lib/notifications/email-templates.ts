// ---------------------------------------------------------------------------
// OKRunit -- Polished HTML Email Templates
// ---------------------------------------------------------------------------
// Beautiful, responsive email templates with inline CSS for maximum
// email client compatibility. Uses the shared emailLayout wrapper.
// ---------------------------------------------------------------------------

import { emailLayout, escapeHtml } from "@/lib/email/layout";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------

function priorityBadge(priority: string): string {
  const configs: Record<string, { bg: string; text: string; border: string; dot: string; label: string }> = {
    critical: { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", dot: "#dc2626", label: "Critical" },
    high: { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa", dot: "#ea580c", label: "High" },
    medium: { bg: "#fefce8", text: "#854d0e", border: "#fef08a", dot: "#ca8a04", label: "Medium" },
    low: { bg: "#f0fdf4", text: "#166534", border: "#bbf7d0", dot: "#16a34a", label: "Low" },
  };
  const p = configs[priority] ?? configs.medium!;

  return `<table role="presentation" cellpadding="0" cellspacing="0">
    <tr>
      <td style="background:${p.bg};border:1px solid ${p.border};border-radius:20px;padding:4px 14px 4px 10px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td style="vertical-align:middle;padding-right:6px;">
              <div style="width:8px;height:8px;border-radius:50%;background:${p.dot};"></div>
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:13px;font-weight:600;color:${p.text};letter-spacing:0.2px;">${p.label}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

function metadataTable(metadata: Record<string, unknown>): string {
  const entries = Object.entries(metadata).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (entries.length === 0) return "";

  const rows = entries
    .map(
      ([key, value]) =>
        `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;font-weight:500;white-space:nowrap;vertical-align:top;">${escapeHtml(key)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;color:#0f172a;font-size:13px;word-break:break-word;">${escapeHtml(String(value))}</td>
      </tr>`,
    )
    .join("");

  return `
    <!-- Metadata -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
      <tr>
        <td colspan="2" style="padding:10px 12px;background:#f1f5f9;border-bottom:1px solid #e2e8f0;">
          <span style="font-size:11px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.8px;">Details</span>
        </td>
      </tr>
      ${rows}
    </table>`;
}

// ---------------------------------------------------------------------------
// 1. Approval Request Email
// ---------------------------------------------------------------------------

export interface ApprovalRequestEmailParams {
  requestId: string;
  title: string;
  description?: string;
  priority: string;
  metadata?: Record<string, unknown>;
  approveUrl: string;
  rejectUrl: string;
  source?: string;
  actionType?: string;
  expiresAt?: string;
  unsubscribeUrl?: string;
}

export function approvalRequestEmail(params: ApprovalRequestEmailParams): string {
  const dashboardUrl = `${APP_URL}/requests#request-${params.requestId}`;

  const descriptionBlock = params.description
    ? `<p style="margin:8px 0 0;color:#64748b;font-size:14px;line-height:22px;">${escapeHtml(params.description)}</p>`
    : "";

  const metadataBlock = params.metadata
    ? metadataTable(params.metadata)
    : "";

  const sourceRow = params.source
    ? `<tr>
        <td style="padding:12px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Source</p>
          <p style="margin:0;color:#0f172a;font-size:14px;font-weight:500;">${escapeHtml(params.source)}</p>
        </td>
      </tr>`
    : "";

  const actionTypeRow = params.actionType
    ? `<tr>
        <td style="padding:12px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Action Type</p>
          <p style="margin:0;color:#0f172a;font-size:14px;font-weight:500;">${escapeHtml(params.actionType)}</p>
        </td>
      </tr>`
    : "";

  const expiresRow = params.expiresAt
    ? `<tr>
        <td style="padding:12px 24px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Expires</p>
          <p style="margin:0;color:#dc2626;font-size:14px;font-weight:500;">${escapeHtml(new Date(params.expiresAt).toLocaleString())}</p>
        </td>
      </tr>`
    : "";

  const unsubscribeBlock = params.unsubscribeUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
        <tr>
          <td align="center">
            <a href="${params.unsubscribeUrl}" style="color:#94a3b8;font-size:12px;text-decoration:underline;">Unsubscribe from these notifications</a>
          </td>
        </tr>
      </table>`
    : "";

  const body = `
    <!-- Green accent bar -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:-40px -40px 0;width:calc(100% + 80px);">
      <tr><td style="height:4px;background:linear-gradient(90deg, #16a34a, #22c55e);"></td></tr>
    </table>

    <div style="height:36px;"></div>

    <!-- Icon + heading -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg, #f0fdf4, #dcfce7);border:1px solid #bbf7d0;text-align:center;line-height:52px;margin:0 auto 20px;">
            <span style="font-size:26px;">&#128276;</span>
          </div>
          <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;text-align:center;">Approval Required</h1>
          <p style="margin:0;font-size:15px;color:#64748b;line-height:22px;text-align:center;">A new request is waiting for your review.</p>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="border-top:1px solid #e2e8f0;"></td></tr>
    </table>

    <!-- Request details card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Request</p>
          <p style="margin:0;color:#0f172a;font-size:17px;font-weight:600;line-height:24px;">${escapeHtml(params.title)}</p>
          ${descriptionBlock}
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Priority</p>
          ${priorityBadge(params.priority)}
        </td>
      </tr>
      ${sourceRow}
      ${actionTypeRow}
      ${expiresRow}
    </table>

    ${metadataBlock}

    <!-- Action buttons -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
      <tr>
        <td align="center" width="50%" style="padding-right:6px;">
          <a href="${params.approveUrl}" style="display:block;padding:14px 24px;background:#16a34a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;text-align:center;box-shadow:0 1px 3px rgba(22,163,74,0.3);">&#10003; Approve</a>
        </td>
        <td align="center" width="50%" style="padding-left:6px;">
          <a href="${params.rejectUrl}" style="display:block;padding:14px 24px;background:#ffffff;color:#dc2626;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;text-align:center;border:1.5px solid #fecaca;">&#10007; Reject</a>
        </td>
      </tr>
    </table>

    <!-- Dashboard link -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr>
        <td align="center">
          <a href="${dashboardUrl}" style="color:#6366f1;font-size:13px;font-weight:500;text-decoration:none;">View in Dashboard &rarr;</a>
        </td>
      </tr>
    </table>

    ${unsubscribeBlock}
  `;

  return emailLayout({
    body,
    preheader: `New approval request: ${params.title}`,
    footerText:
      "This action link expires in 72 hours. If you did not expect this email, you can safely ignore it.",
  });
}

// ---------------------------------------------------------------------------
// 2. Approval Decision Email
// ---------------------------------------------------------------------------

export interface ApprovalDecisionEmailParams {
  requestId: string;
  requestTitle: string;
  decision: "approved" | "rejected" | "cancelled" | "expired";
  decidedBy?: string;
  decidedAt?: string;
  comment?: string;
  unsubscribeUrl?: string;
}

export function approvalDecisionEmail(params: ApprovalDecisionEmailParams): string {
  const dashboardUrl = `${APP_URL}/requests#request-${params.requestId}`;

  const statusMap: Record<string, { color: string; bg: string; border: string; label: string; emoji: string; heading: string }> = {
    approved: { color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", label: "Approved", emoji: "&#9989;", heading: "Request Approved" },
    rejected: { color: "#dc2626", bg: "#fef2f2", border: "#fecaca", label: "Rejected", emoji: "&#10060;", heading: "Request Rejected" },
    cancelled: { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb", label: "Cancelled", emoji: "&#128683;", heading: "Request Cancelled" },
    expired: { color: "#d97706", bg: "#fffbeb", border: "#fde68a", label: "Expired", emoji: "&#9203;", heading: "Request Expired" },
  };

  const s = statusMap[params.decision] ?? statusMap.approved!;

  const decidedByBlock = params.decidedBy
    ? `<tr>
        <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Decided By</p>
          <p style="margin:0;color:#0f172a;font-size:14px;font-weight:500;">${escapeHtml(params.decidedBy)}</p>
        </td>
      </tr>`
    : "";

  const decidedAtBlock = params.decidedAt
    ? `<tr>
        <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">When</p>
          <p style="margin:0;color:#0f172a;font-size:14px;font-weight:500;">${escapeHtml(new Date(params.decidedAt).toLocaleString())}</p>
        </td>
      </tr>`
    : "";

  const commentBlock = params.comment
    ? `<tr>
        <td style="padding:14px 24px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Comment</p>
          <p style="margin:0;color:#334155;font-size:14px;line-height:22px;font-style:italic;background:#f8fafc;border-left:3px solid ${s.color};padding:10px 14px;border-radius:0 6px 6px 0;">&ldquo;${escapeHtml(params.comment)}&rdquo;</p>
        </td>
      </tr>`
    : "";

  const unsubscribeBlock = params.unsubscribeUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
        <tr>
          <td align="center">
            <a href="${params.unsubscribeUrl}" style="color:#94a3b8;font-size:12px;text-decoration:underline;">Unsubscribe from these notifications</a>
          </td>
        </tr>
      </table>`
    : "";

  const body = `
    <!-- Status accent bar -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:-40px -40px 0;width:calc(100% + 80px);">
      <tr><td style="height:4px;background:${s.color};"></td></tr>
    </table>

    <div style="height:36px;"></div>

    <!-- Icon + heading -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <div style="width:52px;height:52px;border-radius:14px;background:${s.bg};border:1px solid ${s.border};text-align:center;line-height:52px;margin:0 auto 20px;">
            <span style="font-size:24px;">${s.emoji}</span>
          </div>
          <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;text-align:center;">${s.heading}</h1>
          <p style="margin:0;font-size:15px;color:#64748b;line-height:22px;text-align:center;">A decision has been made on your approval request.</p>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="border-top:1px solid #e2e8f0;"></td></tr>
    </table>

    <!-- Request details card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Request</p>
          <p style="margin:0;color:#0f172a;font-size:16px;font-weight:600;">${escapeHtml(params.requestTitle)}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 24px;border-bottom:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Decision</p>
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:${s.bg};border:1px solid ${s.border};border-radius:20px;padding:4px 14px 4px 10px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;padding-right:6px;">
                      <div style="width:8px;height:8px;border-radius:50%;background:${s.color};"></div>
                    </td>
                    <td style="vertical-align:middle;">
                      <span style="font-size:13px;font-weight:600;color:${s.color};">${s.label}</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      ${decidedByBlock}
      ${decidedAtBlock}
      ${commentBlock}
    </table>

    <!-- Dashboard button -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
      <tr>
        <td align="center">
          <a href="${dashboardUrl}" style="display:inline-block;padding:14px 36px;background:#0f172a;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.2);">View Details</a>
        </td>
      </tr>
    </table>

    ${unsubscribeBlock}
  `;

  return emailLayout({
    body,
    preheader: `${params.requestTitle} has been ${params.decision}`,
    footerText:
      "You received this email because you are a member of this OKRunit organization.",
  });
}

// ---------------------------------------------------------------------------
// 3. Usage Limit Warning Email
// ---------------------------------------------------------------------------

export interface UsageLimitEmailParams {
  orgName: string;
  resourceType: "requests" | "connections" | "team_members";
  currentUsage: number;
  limit: number;
  planName: string;
  unsubscribeUrl?: string;
}

export function usageLimitEmail(params: UsageLimitEmailParams): string {
  const upgradeUrl = `${APP_URL}/billing`;
  const percentage = Math.min(100, Math.round((params.currentUsage / params.limit) * 100));
  const isOver = params.currentUsage >= params.limit;

  const resourceLabels: Record<string, { singular: string; plural: string }> = {
    requests: { singular: "request", plural: "requests" },
    connections: { singular: "connection", plural: "connections" },
    team_members: { singular: "team member", plural: "team members" },
  };

  const resource = resourceLabels[params.resourceType] ?? resourceLabels.requests!;
  const barColor = isOver ? "#dc2626" : percentage >= 90 ? "#ea580c" : "#d97706";
  const barBg = isOver ? "#fef2f2" : percentage >= 90 ? "#fff7ed" : "#fffbeb";
  const headingText = isOver
    ? `${resource.singular.charAt(0).toUpperCase() + resource.singular.slice(1)} Limit Reached`
    : `Approaching ${resource.singular.charAt(0).toUpperCase() + resource.singular.slice(1)} Limit`;

  const unsubscribeBlock = params.unsubscribeUrl
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
        <tr>
          <td align="center">
            <a href="${params.unsubscribeUrl}" style="color:#94a3b8;font-size:12px;text-decoration:underline;">Unsubscribe from these notifications</a>
          </td>
        </tr>
      </table>`
    : "";

  const body = `
    <!-- Warning accent bar -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:-40px -40px 0;width:calc(100% + 80px);">
      <tr><td style="height:4px;background:${barColor};"></td></tr>
    </table>

    <div style="height:36px;"></div>

    <!-- Icon + heading -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <div style="width:52px;height:52px;border-radius:14px;background:${barBg};border:1px solid ${isOver ? "#fecaca" : "#fde68a"};text-align:center;line-height:52px;margin:0 auto 20px;">
            <span style="font-size:26px;">${isOver ? "&#128680;" : "&#9888;&#65039;"}</span>
          </div>
          <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;text-align:center;">${headingText}</h1>
          <p style="margin:0;font-size:15px;color:#64748b;line-height:22px;text-align:center;">
            ${isOver
              ? `Your organization <strong>${escapeHtml(params.orgName)}</strong> has reached its monthly ${resource.singular} limit.`
              : `Your organization <strong>${escapeHtml(params.orgName)}</strong> is approaching its monthly ${resource.singular} limit.`
            }
          </p>
        </td>
      </tr>
    </table>

    <!-- Divider -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
      <tr><td style="border-top:1px solid #e2e8f0;"></td></tr>
    </table>

    <!-- Usage card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;">
      <tr>
        <td style="padding:20px 24px;">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Current Plan</p>
          <p style="margin:0 0 16px;color:#0f172a;font-size:16px;font-weight:600;">${escapeHtml(params.planName)}</p>

          <!-- Usage stats -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;">
            <tr>
              <td>
                <span style="font-size:28px;font-weight:700;color:${barColor};">${params.currentUsage.toLocaleString()}</span>
                <span style="font-size:14px;color:#94a3b8;margin-left:4px;">/ ${params.limit.toLocaleString()} ${resource.plural}</span>
              </td>
              <td align="right">
                <span style="font-size:14px;font-weight:600;color:${barColor};">${percentage}%</span>
              </td>
            </tr>
          </table>

          <!-- Progress bar -->
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0;">
                <div style="width:100%;height:10px;background:#e2e8f0;border-radius:5px;overflow:hidden;">
                  <div style="width:${Math.min(100, percentage)}%;height:100%;background:${barColor};border-radius:5px;"></div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Upgrade CTA -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
      <tr>
        <td align="center">
          <a href="${upgradeUrl}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg, #6366f1, #8b5cf6);color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:8px;box-shadow:0 2px 4px rgba(99,102,241,0.3);">Upgrade Plan</a>
        </td>
      </tr>
    </table>

    <!-- Secondary link -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0 0;">
      <tr>
        <td align="center">
          <a href="${APP_URL}/billing" style="color:#6366f1;font-size:13px;font-weight:500;text-decoration:none;">View billing details &rarr;</a>
        </td>
      </tr>
    </table>

    ${unsubscribeBlock}
  `;

  return emailLayout({
    body,
    preheader: isOver
      ? `${params.orgName}: ${resource.singular} limit reached`
      : `${params.orgName}: ${percentage}% of ${resource.singular} limit used`,
    footerText:
      "You received this email because you are an admin of this OKRunit organization.",
  });
}
