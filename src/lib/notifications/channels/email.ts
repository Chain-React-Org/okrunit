// ---------------------------------------------------------------------------
// OKrunit -- Email Notification Channel (Resend)
// ---------------------------------------------------------------------------

import { Resend } from "resend";
import { logger } from "@/lib/monitoring/logger";
import {
  type EmailTone,
  PROD_URL,
  emailButton,
  emailCard,
  emailHeroBanner,
  emailLayout,
  emailMetadataRows,
  emailPill,
  emailTheme,
  escapeHtml,
} from "@/lib/email/layout";

const FROM_EMAIL =
  process.env.EMAIL_FROM || "OKrunit <noreply@okrunit.com>";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailNotificationParams {
  to: string;
  subject: string;
  requestId: string;
  title: string;
  description?: string;
  priority: string;
  approveToken: string;
  rejectToken: string;
}

export interface DecisionEmailParams {
  to: string;
  subject: string;
  requestTitle: string;
  decision: string;
  decidedBy?: string;
  comment?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Lazily initialised Resend client. Returns null if RESEND_API_KEY is not set. */
function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

/** Map a priority string to its display colour. */
function priorityConfig(priority: string): {
  tone: EmailTone;
  dot: string;
  label: string;
} {
  const configs: Record<
    string,
    { tone: EmailTone; dot: string; label: string }
  > = {
    critical: {
      tone: "danger",
      dot: "#dc2626",
      label: "Critical",
    },
    high: {
      tone: "warning",
      dot: "#ea580c",
      label: "High",
    },
    medium: {
      tone: "neutral",
      dot: "#ca8a04",
      label: "Medium",
    },
    low: {
      tone: "brand",
      dot: "#16a34a",
      label: "Low",
    },
  };

  return configs[priority] ?? configs.medium!;
}

// ---------------------------------------------------------------------------
// Email Templates (exported for preview page)
// ---------------------------------------------------------------------------

export function buildApprovalEmailHtml(params: EmailNotificationParams): string {
  const approveUrl = `${PROD_URL}/api/email-actions/${params.approveToken}`;
  const rejectUrl = `${PROD_URL}/api/email-actions/${params.rejectToken}`;
  const dashboardUrl = `${PROD_URL}/requests`;
  const p = priorityConfig(params.priority);

  const descriptionBlock = params.description
    ? `<p style="margin:12px 0 0;color:${emailTheme.text};font-size:14px;line-height:23px;">${escapeHtml(params.description)}</p>`
    : "";

  const hero = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td align="center">
          <h1 style="margin:0 0 10px;color:${emailTheme.ink};font-size:28px;font-weight:700;line-height:36px;letter-spacing:-0.5px;text-align:center;">
            Approval required
          </h1>
          <p style="margin:0;color:${emailTheme.text};font-size:15px;line-height:26px;text-align:center;">
            A new request is waiting for your review.
          </p>
        </td>
      </tr>
    </table>
  `;

  const body = [
    hero,
    emailCard(
      `
        <p style="margin:0 0 4px;color:${emailTheme.subtle};font-size:11px;font-weight:700;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;">
          Request
        </p>
        <p style="margin:0;color:${emailTheme.ink};font-size:20px;font-weight:700;line-height:28px;letter-spacing:-0.3px;">
          ${escapeHtml(params.title)}
        </p>
        ${descriptionBlock}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:18px 0 0;">
          <tr>
            <td style="vertical-align:middle;">
              ${emailPill({
                label: p.label,
                tone: p.tone,
                dotColor: p.dot,
              })}
            </td>
            <td align="right" style="vertical-align:middle;">
              <span style="display:inline-block;color:${emailTheme.muted};font-size:12px;font-weight:700;line-height:18px;letter-spacing:0.2px;">
                ID ${escapeHtml(params.requestId)}
              </span>
            </td>
          </tr>
        </table>
      `,
      { tone: "neutral" },
    ),
    `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
        <tr>
          <td width="50%" style="padding-right:8px;vertical-align:top;text-align:center;">${emailButton({ label: "Approve", href: approveUrl, block: true })}</td>
          <td width="50%" style="padding-left:8px;vertical-align:top;text-align:center;">${emailButton({ label: "Reject", href: rejectUrl, variant: "danger-secondary", block: true })}</td>
        </tr>
      </table>
    `,
    emailCard(
      `
        ${emailMetadataRows([
          {
            label: "Action Window",
            valueHtml: "One-click links stay active for <strong>72 hours</strong>.",
          },
          {
            label: "Full Context",
            valueHtml: `<a href="${dashboardUrl}" style="color:${emailTheme.brandDark};font-weight:700;text-decoration:none;">Open the request in OKrunit &rarr;</a>`,
            borderless: true,
          },
        ])}
      `,
      { tone: "brand", marginTop: 20 },
    ),
  ].join("");

  return emailLayout({
    heroBanner: emailHeroBanner({ image: "approval-bell.svg", imageWidth: 160, imageHeight: 136, alt: "Approval required", compact: true }),
    body,
    preheader: `New approval request: ${params.title}`,
    footerText: "Action links expire in 72 hours. If you did not expect this email, you can safely ignore it.",
  });
}

export function buildDecisionEmailHtml(params: DecisionEmailParams): string {
  const dashboardUrl = `${PROD_URL}/requests`;

  const isApproved = params.decision === "approved";
  const statusTone: EmailTone = isApproved ? "brand" : "danger";
  const statusColor = isApproved ? emailTheme.brand : emailTheme.danger;
  const statusLabel = isApproved ? "Approved" : "Rejected";
  const heroImage = isApproved ? "approved-check.svg" : "rejected-x.svg";
  const heroAlt = isApproved ? "Request approved" : "Request rejected";

  const rows: { label: string; valueHtml: string; borderless?: boolean }[] = [
    {
      label: "Request",
      valueHtml: `<span style="font-weight:700;color:${emailTheme.ink};">${escapeHtml(params.requestTitle)}</span>`,
    },
    {
      label: "Decision",
      valueHtml: emailPill({
        label: statusLabel,
        tone: statusTone,
        dotColor: statusColor,
      }),
      borderless: !params.decidedBy && !params.comment,
    },
    ...(params.decidedBy
      ? [
          {
            label: "Decided By",
            valueHtml: escapeHtml(params.decidedBy),
            borderless: !params.comment,
          },
        ]
      : []),
  ];

  const decisionHero = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td align="center">
          <h1 style="margin:0 0 10px;color:${emailTheme.ink};font-size:28px;font-weight:700;line-height:36px;letter-spacing:-0.5px;text-align:center;">
            Request ${statusLabel}
          </h1>
          <p style="margin:0;color:${emailTheme.text};font-size:15px;line-height:26px;text-align:center;">
            A decision has been made on your approval request.
          </p>
        </td>
      </tr>
    </table>
  `;

  const body = [
    decisionHero,
    emailCard(
      emailMetadataRows(rows),
      { tone: "neutral" },
    ),
    params.comment
      ? emailCard(
          `
            <p style="margin:0 0 8px;color:${emailTheme.subtle};font-size:11px;font-weight:700;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;">
              Reviewer Comment
            </p>
            <p style="margin:0;color:${emailTheme.ink};font-size:15px;line-height:25px;font-style:italic;">
              &ldquo;${escapeHtml(params.comment)}&rdquo;
            </p>
          `,
          { tone: statusTone, marginTop: 20 },
        )
      : "",
    `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
        <tr>
          <td align="center">
            ${emailButton({ label: "View in Dashboard", href: dashboardUrl, variant: "dark" })}
          </td>
        </tr>
      </table>
    `,
  ].join("");

  return emailLayout({
    heroBanner: emailHeroBanner({ image: heroImage, imageWidth: 160, imageHeight: 136, alt: heroAlt, compact: true }),
    body,
    preheader: `${params.requestTitle} has been ${params.decision}`,
    footerText: "You received this email because you are a member of this OKrunit organization.",
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send an approval notification email with one-click approve/reject links.
 *
 * Handles missing `RESEND_API_KEY` gracefully by logging a warning and
 * skipping the send -- this allows local development without email
 * infrastructure.
 */
export async function sendApprovalEmail(
  params: EmailNotificationParams,
): Promise<void> {
  const resend = getResendClient();

  if (!resend) {
    logger.warn(
      "[Email] RESEND_API_KEY is not set -- skipping approval email to",
      params.to,
    );
    return;
  }

  try {
    const html = buildApprovalEmailHtml(params);

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html,
    });

    if (error) {
      logger.error("[Email] Resend API error:", error);
      return;
    }

    logger.info(
      `[Email] Approval email sent to ${params.to} for request ${params.requestId}`,
    );
  } catch (err) {
    logger.error("[Email] Failed to send approval email:", err);
  }
}

/**
 * Send a notification about a decision (approved/rejected/cancelled).
 *
 * Like `sendApprovalEmail`, gracefully degrades when Resend is not configured.
 */
export async function sendDecisionEmail(
  params: DecisionEmailParams,
): Promise<void> {
  const resend = getResendClient();

  if (!resend) {
    logger.warn(
      "[Email] RESEND_API_KEY is not set -- skipping decision email to",
      params.to,
    );
    return;
  }

  try {
    const html = buildDecisionEmailHtml(params);

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html,
    });

    if (error) {
      logger.error("[Email] Resend API error:", error);
      return;
    }

    logger.info(
      `[Email] Decision email sent to ${params.to} for "${params.requestTitle}"`,
    );
  } catch (err) {
    logger.error("[Email] Failed to send decision email:", err);
  }
}
