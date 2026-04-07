// ---------------------------------------------------------------------------
// OKrunit -- Account Deletion Confirmation Email (v4, Vend-inspired)
// ---------------------------------------------------------------------------

import {
  emailButton,
  emailCard,
  emailHeroBanner,
  emailIconCircle,
  emailLayout,
  emailMetadataRows,
  emailPill,
  emailSignoff,
  emailTheme,
} from "@/lib/email/layout";

export interface AccountDeletionEmailParams {
  confirmLink: string;
  graceDays: number;
  expiryHours?: number;
}

export function buildAccountDeletionEmailHtml(
  params: AccountDeletionEmailParams,
): string {
  const {
    confirmLink,
    graceDays,
    expiryHours = 24,
  } = params;

  const body = [
    // -- Centered hero (compact) --
    `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
        <tr>
          <td align="center">
            <h1 style="margin:0 0 10px;color:${emailTheme.ink};font-size:28px;font-weight:700;line-height:36px;letter-spacing:-0.5px;text-align:center;">
              Confirm account deletion
            </h1>
            <p style="margin:0;color:${emailTheme.text};font-size:15px;line-height:26px;text-align:center;">
              We received a request to permanently delete your OKrunit account. This action requires one final confirmation before it takes effect.
            </p>
          </td>
        </tr>
      </table>
    `,

    // -- Danger pill --
    `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:-16px 0 24px;">
        <tr>
          <td align="center">
            ${emailPill({ label: "Sensitive action", tone: "danger" })}
          </td>
        </tr>
      </table>
    `,

    // -- Danger metadata card --
    emailCard(
      emailMetadataRows([
        {
          label: "Recovery Period",
          valueHtml: `After confirmation your account enters a <strong style="color:${emailTheme.ink};">${graceDays}-day recovery window</strong>. You can cancel the deletion at any time from your account settings during that period.`,
        },
        {
          label: "Link Expiry",
          valueHtml: `This confirmation link is valid for <strong style="color:${emailTheme.ink};">${expiryHours} hours</strong>. After that you will need to initiate a new deletion request.`,
        },
        {
          label: "What Happens Next",
          valueHtml:
            "Once the recovery period ends, your account, organizations you own, and all associated data are permanently and irreversibly removed.",
          borderless: true,
        },
      ]),
      { tone: "danger" },
    ),

    // -- Confirm button (danger, reduced margin) --
    `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
        <tr>
          <td align="center">
            ${emailButton({ label: "Confirm Deletion", href: confirmLink, variant: "danger" })}
          </td>
        </tr>
      </table>
    `,

    // -- Reassurance card --
    emailCard(
      `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:58px;vertical-align:top;padding-right:16px;">
              ${emailIconCircle("delete-warning.svg", { tone: "neutral", size: 44 })}
            </td>
            <td style="vertical-align:top;">
              <p style="margin:0;color:${emailTheme.ink};font-size:14px;font-weight:700;line-height:22px;">
                Didn't request this?
              </p>
              <p style="margin:6px 0 0;color:${emailTheme.text};font-size:13px;line-height:21px;">
                No action is needed on your part. Your account will remain fully active unless you explicitly confirm the deletion using the link above. If you are concerned about unauthorized access, we recommend changing your password.
              </p>
            </td>
          </tr>
        </table>
      `,
      { tone: "neutral", marginTop: 20 },
    ),

    // -- Sign-off --
    emailSignoff({
      name: "The OKrunit Team",
      title: "Account Security",
      align: "center",
    }),
  ].join("");

  return emailLayout({
    heroBanner: emailHeroBanner({ image: "delete-warning.svg", imageWidth: 144, imageHeight: 136, alt: "Account deletion", compact: true }),
    body,
    preheader: "Confirm your account deletion request",
    footerText:
      "You received this email because a deletion request was initiated for your OKrunit account.",
  });
}
