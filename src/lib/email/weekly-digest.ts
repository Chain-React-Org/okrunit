// ---------------------------------------------------------------------------
// OKrunit -- Weekly Digest Email Template (v2, Vend-inspired)
// ---------------------------------------------------------------------------

import {
  PROD_URL,
  emailButton,
  emailCard,
  emailDivider,
  emailHeroBanner,
  emailLayout,
  emailPill,
  emailProgressBar,
  emailSignoff,
  emailStatBlock,
  emailTheme,
  escapeHtml,
} from "@/lib/email/layout";

export interface WeeklyDigestEmailParams {
  fullName: string;
  orgName: string;
  periodStart: string;
  periodEnd: string;
  stats: {
    totalRequests: number;
    approved: number;
    rejected: number;
    pending: number;
    avgResponseTimeHours: number | null;
  };
  topConnections: { name: string; count: number }[];
}

export function buildWeeklyDigestEmailHtml(
  params: WeeklyDigestEmailParams,
): string {
  const { fullName, orgName, periodStart, periodEnd, stats, topConnections } =
    params;

  const approvalRate =
    stats.totalRequests > 0
      ? Math.round((stats.approved / stats.totalRequests) * 100)
      : 0;

  const responseTimeLabel =
    stats.avgResponseTimeHours === null
      ? "No data yet"
      : stats.avgResponseTimeHours < 1
        ? `${Math.round(stats.avgResponseTimeHours * 60)} min`
        : `${stats.avgResponseTimeHours.toFixed(1)} hrs`;

  // --- Hero banner ---
  const heroBanner = emailHeroBanner({ image: "weekly-digest.svg", imageWidth: 160, imageHeight: 120, alt: "Weekly digest", compact: true });

  // --- Hero (compact) ---
  const hero = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td align="center">
          <h1 style="margin:0 0 10px;color:${emailTheme.ink};font-size:28px;font-weight:700;line-height:36px;letter-spacing:-0.5px;text-align:center;">
            Your week at ${escapeHtml(orgName)}
          </h1>
          <p style="margin:0;color:${emailTheme.text};font-size:15px;line-height:26px;text-align:center;">
            Hi ${escapeHtml(fullName)}, here\u2019s your activity summary for <strong style="color:${emailTheme.ink};">${escapeHtml(orgName)}</strong>.
          </p>
          <div style="margin:8px 0 0;color:${emailTheme.muted};font-size:14px;line-height:22px;text-align:center;">${escapeHtml(periodStart)} &ndash; ${escapeHtml(periodEnd)}</div>
        </td>
      </tr>
    </table>
  `;

  // --- 2x2 Stat Grid ---
  const statGrid = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
          ${emailStatBlock({ value: stats.totalRequests, label: "Total Requests", tone: "neutral" })}
        </td>
        <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
          ${emailStatBlock({ value: stats.approved, label: "Approved", tone: "brand" })}
        </td>
      </tr>
      <tr><td colspan="2" style="height:12px;font-size:0;line-height:0;">&nbsp;</td></tr>
      <tr>
        <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
          ${emailStatBlock({ value: stats.rejected, label: "Rejected", tone: "danger" })}
        </td>
        <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
          ${emailStatBlock({ value: stats.pending, label: "Pending", tone: "warning" })}
        </td>
      </tr>
    </table>
  `;

  // --- Performance card: approval rate + response time ---
  const approvalTone =
    approvalRate >= 80 ? "brand" : approvalRate >= 60 ? "warning" : "danger";
  const approvalBarColor =
    approvalTone === "brand"
      ? emailTheme.brand
      : approvalTone === "warning"
        ? emailTheme.warning
        : emailTheme.danger;

  const performanceCard = emailCard(
    `
      <!-- Approval Rate -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:${emailTheme.ink};font-size:14px;font-weight:700;line-height:22px;padding:0 0 10px;">
            Approval rate
          </td>
          <td align="right" style="padding:0 0 10px;">
            ${emailPill({ label: `${approvalRate}%`, tone: approvalTone })}
          </td>
        </tr>
        <tr>
          <td colspan="2" style="padding:0 0 4px;">
            ${emailProgressBar({ percent: approvalRate, color: approvalBarColor })}
          </td>
        </tr>
      </table>
      ${emailDivider(20, 20)}
      <!-- Avg Response Time -->
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:${emailTheme.ink};font-size:14px;font-weight:700;line-height:22px;">
            Average response time
          </td>
          <td align="right" style="color:${emailTheme.text};font-size:15px;font-weight:700;line-height:22px;">
            ${responseTimeLabel}
          </td>
        </tr>
      </table>
    `,
    { tone: "neutral", marginTop: 20 },
  );

  // --- Top Sources ---
  const connectionRows =
    topConnections.length > 0
      ? topConnections
          .map((c, idx) => {
            const isLast = idx === topConnections.length - 1;
            return `
              <tr>
                <td style="padding:12px 0;${!isLast ? `border-bottom:1px solid ${emailTheme.divider};` : ""}">
                  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="color:${emailTheme.ink};font-size:14px;font-weight:600;line-height:22px;">
                        ${escapeHtml(c.name)}
                      </td>
                      <td align="right" style="color:${emailTheme.muted};font-size:13px;font-weight:600;line-height:22px;">
                        ${c.count} request${c.count !== 1 ? "s" : ""}
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            `;
          })
          .join("")
      : `<tr><td style="padding:20px 0;color:${emailTheme.muted};font-size:13px;text-align:center;">No activity this week</td></tr>`;

  const sourcesCard = emailCard(
    `
      <p style="margin:0 0 16px;color:${emailTheme.muted};font-size:11px;font-weight:700;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;">
        Top Sources
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${connectionRows}
      </table>
    `,
    { tone: "neutral", marginTop: 20 },
  );

  // --- CTA (reduced margin) ---
  const cta = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr>
        <td align="center">
          ${emailButton({ label: "View Dashboard", href: `${PROD_URL}/org/overview`, variant: "dark" })}
        </td>
      </tr>
    </table>
  `;

  // --- Sign-off ---
  const signoff = emailSignoff({
    name: "The OKrunit Team",
    title: "Weekly Insights",
    align: "center",
  });

  const body = [hero, statGrid, performanceCard, sourcesCard, cta, signoff].join("");

  return emailLayout({
    body,
    heroBanner,
    preheader: `${orgName}: ${stats.totalRequests} requests this week, ${approvalRate}% approval rate`,
    footerText:
      `You received this weekly digest because you are a member of the ${orgName} organization. Manage preferences in your settings.`,
  });
}
