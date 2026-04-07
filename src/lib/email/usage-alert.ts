// ---------------------------------------------------------------------------
// OKrunit -- Usage Alert Email Template (v2, Vend-inspired)
// ---------------------------------------------------------------------------

import {
  PROD_URL,
  emailButton,
  emailCard,
  emailHeroBanner,
  emailLayout,
  emailMetadataRows,
  emailPill,
  emailProgressBar,
  emailSignoff,
  emailTheme,
  escapeHtml,
} from "@/lib/email/layout";

export interface UsageAlertEmailParams {
  orgName: string;
  alerts: { type: string; current: number; limit: number }[];
  plan: string;
}

function formatType(type: string): string {
  switch (type) {
    case "requests":
      return "Approval Requests";
    case "connections":
      return "Connections";
    case "team_members":
      return "Team Members";
    default:
      return type;
  }
}

export function buildUsageAlertEmailHtml(
  params: UsageAlertEmailParams,
): string {
  const { orgName, alerts, plan } = params;

  // --- Hero banner ---
  const heroBanner = emailHeroBanner({ image: "usage-chart.svg", imageWidth: 160, imageHeight: 120, alt: "Usage alert", compact: true });

  // --- Hero (compact) ---
  const hero = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
      <tr>
        <td align="center">
          <h1 style="margin:0 0 10px;color:${emailTheme.ink};font-size:28px;font-weight:700;line-height:36px;letter-spacing:-0.5px;text-align:center;">
            Usage Alert
          </h1>
          <p style="margin:0;color:${emailTheme.text};font-size:15px;line-height:26px;text-align:center;">
            <strong style="color:${emailTheme.ink};">${escapeHtml(orgName)}</strong> is nearing the capacity of your <strong style="color:${emailTheme.ink};">${escapeHtml(plan)}</strong> plan. Review your usage below.
          </p>
        </td>
      </tr>
    </table>
  `;

  // --- Metadata card ---
  const metadata = emailCard(
    emailMetadataRows([
      {
        label: "Organization",
        valueHtml: `<span style="font-weight:700;color:${emailTheme.ink};">${escapeHtml(orgName)}</span>`,
      },
      {
        label: "Current Plan",
        valueHtml: `<span style="font-weight:700;color:${emailTheme.ink};">${escapeHtml(plan)}</span>`,
      },
      {
        label: "Recommended Action",
        valueHtml:
          "Review usage now to avoid disruptions during active approval windows.",
        borderless: true,
      },
    ]),
    { tone: "neutral" },
  );

  // --- Capacity at a glance ---
  const capacityRows = alerts
    .map((a, idx) => {
      const pct = Math.round((a.current / a.limit) * 100);
      const atLimit = a.current >= a.limit;
      const tone = atLimit ? "danger" : pct >= 90 ? "warning" : "brand";
      const barColor =
        tone === "danger"
          ? emailTheme.danger
          : tone === "warning"
            ? emailTheme.warning
            : emailTheme.brand;
      const remaining = Math.max(a.limit - a.current, 0);
      const isLast = idx === alerts.length - 1;

      return `
        <tr>
          <td style="padding:0;">
            <!-- Header row: name + pill -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:${emailTheme.ink};font-size:14px;font-weight:700;line-height:22px;padding:0 0 10px;">
                  ${escapeHtml(formatType(a.type))}
                </td>
                <td align="right" style="padding:0 0 10px;">
                  ${emailPill({ label: `${pct}%`, tone })}
                </td>
              </tr>
            </table>
            <!-- Progress bar -->
            ${emailProgressBar({ percent: pct, color: barColor })}
            <!-- Usage detail -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 0;">
              <tr>
                <td style="color:${emailTheme.text};font-size:13px;line-height:20px;">
                  ${a.current.toLocaleString()} of ${a.limit.toLocaleString()} used
                </td>
                <td align="right" style="color:${atLimit ? emailTheme.danger : emailTheme.muted};font-size:13px;font-weight:${atLimit ? "700" : "500"};line-height:20px;">
                  ${remaining.toLocaleString()} remaining
                </td>
              </tr>
            </table>
            ${!isLast ? `<div style="height:1px;background:${emailTheme.divider};margin:20px 0;"></div>` : ""}
          </td>
        </tr>
      `;
    })
    .join("");

  const capacityCard = emailCard(
    `
      <p style="margin:0 0 20px;color:${emailTheme.muted};font-size:11px;font-weight:700;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;">
        Capacity at a Glance
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${capacityRows}
      </table>
    `,
    { tone: "neutral", marginTop: 20 },
  );

  // --- CTA (reduced margin) ---
  const cta = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
      <tr>
        <td align="center">
          ${emailButton({ label: "Review Billing", href: `${PROD_URL}/org/billing`, variant: "primary" })}
        </td>
      </tr>
    </table>
  `;

  // --- Sign-off ---
  const signoff = emailSignoff({
    name: "The OKrunit Team",
    title: "Billing & Usage",
    align: "center",
  });

  const body = [hero, metadata, capacityCard, cta, signoff].join("");

  return emailLayout({
    body,
    heroBanner,
    preheader: `${orgName} is approaching plan limits`,
    footerText:
      `You received this email because you are an owner or admin of the ${orgName} organization.`,
  });
}
