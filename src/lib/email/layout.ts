// ---------------------------------------------------------------------------
// OKrunit -- Shared Email Layout (v4)
// ---------------------------------------------------------------------------
// Warm, distinctive transactional email design inspired by best-in-class
// onboarding emails. Full-width hero banners, centered illustrations,
// friendly conversational tone, and the real OKrunit logo.
// ---------------------------------------------------------------------------

/** Escape basic HTML entities to prevent XSS in user-supplied strings. */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const PROD_URL = "https://okrunit.com";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || PROD_URL;
const LOGO_URL = `${PROD_URL}/logo_text.png`;

export { APP_URL, PROD_URL };

export const emailTheme = {
  // Canvas & Card
  pageBackground: "#f5f7f5",
  cardBackground: "#ffffff",
  cardBorder: "#e4e9e4",
  // Typography
  ink: "#1a2e1a",
  text: "#4a5f4a",
  muted: "#6b7c6b",
  subtle: "#94a394",
  // Structure
  divider: "#e4e9e4",
  // Brand - green matching the OKrunit logo
  brand: "#4caf50",
  brandBright: "#66bb6a",
  brandDark: "#388e3c",
  brandSubtle: "#e8f5e9",
  brandDeep: "#2e7d32",
  // Charcoal - from the logo hexagon
  charcoal: "#37474f",
  charcoalLight: "#546e7a",
  charcoalDark: "#263238",
  // Status
  success: "#4caf50",
  warning: "#ff9800",
  danger: "#f44336",
  info: "#2196f3",
  // Hero banner
  heroBg: "#edf7ed",
  heroBorder: "#c8e6c9",
} as const;

export type EmailTone =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

type EmailButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "danger-secondary"
  | "dark";

interface EmailHeroOptions {
  eyebrow?: string;
  title: string;
  descriptionHtml: string;
  supportingHtml?: string;
  align?: "left" | "center";
}

interface EmailCardOptions {
  tone?: EmailTone;
  padding?: string;
  marginTop?: number;
}

interface EmailButtonOptions {
  label: string;
  href: string;
  variant?: EmailButtonVariant;
  block?: boolean;
}

interface EmailPillOptions {
  label: string;
  tone?: EmailTone;
  dotColor?: string;
}

interface EmailMetadataRow {
  label: string;
  valueHtml: string;
  borderless?: boolean;
}

function tonePalette(tone: EmailTone) {
  const palettes: Record<
    EmailTone,
    { background: string; border: string; text: string; dot: string }
  > = {
    neutral: {
      background: "#f7f9f7",
      border: "#e4e9e4",
      text: "#37474f",
      dot: "#6b7c6b",
    },
    brand: {
      background: "#e8f5e9",
      border: "#a5d6a7",
      text: "#2e7d32",
      dot: emailTheme.brand,
    },
    success: {
      background: "#e8f5e9",
      border: "#a5d6a7",
      text: "#2e7d32",
      dot: emailTheme.success,
    },
    warning: {
      background: "#fff8e1",
      border: "#ffe082",
      text: "#e65100",
      dot: emailTheme.warning,
    },
    danger: {
      background: "#ffebee",
      border: "#ef9a9a",
      text: "#c62828",
      dot: emailTheme.danger,
    },
    info: {
      background: "#e3f2fd",
      border: "#90caf9",
      text: "#1565c0",
      dot: emailTheme.info,
    },
  };

  return palettes[tone];
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export function emailHero(options: EmailHeroOptions): string {
  const {
    eyebrow,
    title,
    descriptionHtml,
    supportingHtml,
    align = "center",
  } = options;
  const textAlign = `text-align:${align};`;
  const alignAttr = align === "center" ? ' align="center"' : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 32px;">
      <tr>
        <td${alignAttr}>
          ${
            eyebrow
              ? `<p style="margin:0 0 14px;color:${emailTheme.brandDark};font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;${textAlign}">${escapeHtml(eyebrow)}</p>`
              : ""
          }
          <h1 style="margin:0 0 16px;color:${emailTheme.ink};font-size:30px;font-weight:700;line-height:38px;letter-spacing:-0.5px;${textAlign}">
            ${title}
          </h1>
          <p style="margin:0;color:${emailTheme.text};font-size:16px;line-height:28px;${textAlign}">
            ${descriptionHtml}
          </p>
          ${
            supportingHtml
              ? `<div style="margin:16px 0 0;color:${emailTheme.muted};font-size:14px;line-height:22px;${textAlign}">${supportingHtml}</div>`
              : ""
          }
        </td>
      </tr>
    </table>
  `;
}

export function emailCard(content: string, options: EmailCardOptions = {}): string {
  const {
    tone = "neutral",
    padding = "28px 32px",
    marginTop = 0,
  } = options;
  const palette = tonePalette(tone);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:${marginTop}px 0 0;background:${palette.background};border:1px solid ${palette.border};border-radius:16px;overflow:hidden;">
      <tr>
        <td style="padding:${padding};">
          ${content}
        </td>
      </tr>
    </table>
  `;
}

export function emailButton(options: EmailButtonOptions): string {
  const { label, href, variant = "primary", block = false } = options;
  const variants: Record<
    EmailButtonVariant,
    { background: string; border: string; color: string }
  > = {
    primary: {
      background: emailTheme.brandDark,
      border: emailTheme.brandDeep,
      color: "#ffffff",
    },
    secondary: {
      background: "#ffffff",
      border: emailTheme.cardBorder,
      color: emailTheme.charcoal,
    },
    danger: {
      background: emailTheme.danger,
      border: "#d32f2f",
      color: "#ffffff",
    },
    "danger-secondary": {
      background: "#ffffff",
      border: "#ef9a9a",
      color: emailTheme.danger,
    },
    dark: {
      background: emailTheme.charcoal,
      border: emailTheme.charcoalDark,
      color: "#ffffff",
    },
  };

  const c = variants[variant];

  return `<a href="${href}" style="display:${block ? "block" : "inline-block"};padding:14px 28px;background:${c.background};border:1px solid ${c.border};border-radius:8px;color:${c.color};font-size:15px;font-weight:700;line-height:20px;letter-spacing:0.3px;text-decoration:none;text-align:center;text-transform:uppercase;">${escapeHtml(label)}</a>`;
}

export function emailButtonRow(buttons: string[]): string {
  if (buttons.length === 0) return "";

  if (buttons.length === 1) {
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
        <tr>
          <td align="center">
            ${buttons[0]}
          </td>
        </tr>
      </table>
    `;
  }

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
      <tr>
        <td width="50%" style="padding-right:8px;vertical-align:top;text-align:center;">${buttons[0]}</td>
        <td width="50%" style="padding-left:8px;vertical-align:top;text-align:center;">${buttons[1]}</td>
      </tr>
    </table>
  `;
}

export function emailPill(options: EmailPillOptions): string {
  const {
    label,
    tone = "neutral",
    dotColor,
  } = options;
  const palette = tonePalette(tone);
  const dot = dotColor ?? palette.dot;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="background:${palette.background};border:1px solid ${palette.border};border-radius:999px;padding:5px 14px 5px 11px;">
          <table role="presentation" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;padding-right:8px;">
                <div style="width:8px;height:8px;border-radius:50%;background:${dot};"></div>
              </td>
              <td style="vertical-align:middle;">
                <span style="display:inline-block;color:${palette.text};font-size:12px;font-weight:700;line-height:16px;letter-spacing:0.3px;">${escapeHtml(label)}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;
}

export function emailMetadataRows(rows: EmailMetadataRow[]): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${rows
        .map(
          (row) => `
            <tr>
              <td style="padding:0 0 ${row.borderless ? 0 : 18}px;${
                row.borderless
                  ? ""
                  : `border-bottom:1px solid ${emailTheme.divider};`
              }">
                <p style="margin:0 0 6px;color:${emailTheme.subtle};font-size:11px;font-weight:700;line-height:16px;letter-spacing:1.4px;text-transform:uppercase;">
                  ${escapeHtml(row.label)}
                </p>
                <div style="color:${emailTheme.ink};font-size:15px;font-weight:500;line-height:24px;">
                  ${row.valueHtml}
                </div>
              </td>
            </tr>
            ${row.borderless ? "" : `<tr><td style="height:18px;font-size:0;line-height:0;">&nbsp;</td></tr>`}
          `,
        )
        .join("")}
    </table>
  `;
}

export function emailDivider(marginTop = 28, marginBottom = 28): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:${marginTop}px 0 ${marginBottom}px;">
      <tr>
        <td style="border-top:1px solid ${emailTheme.divider};font-size:0;line-height:0;">&nbsp;</td>
      </tr>
    </table>
  `;
}

/** Centered illustration section with hosted image (like Vend's setup cards) */
export function emailIllustrationSection(options: {
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  title: string;
  descriptionHtml: string;
  linkText?: string;
  linkHref?: string;
}): string {
  const { image, imageWidth = 140, imageHeight = 120, title, descriptionHtml, linkText, linkHref } = options;

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center" style="padding:28px 20px;">
          <img
            src="${PROD_URL}/email/${image}"
            alt="${escapeHtml(title)}"
            width="${imageWidth}"
            height="${imageHeight}"
            style="display:block;width:${imageWidth}px;height:${imageHeight}px;margin:0 auto 20px;border:0;"
          />
          <p style="margin:0 0 8px;color:${emailTheme.ink};font-size:18px;font-weight:700;line-height:26px;text-align:center;">
            ${escapeHtml(title)}
          </p>
          <p style="margin:0;color:${emailTheme.text};font-size:14px;line-height:24px;text-align:center;max-width:360px;">
            ${descriptionHtml}
          </p>
          ${
            linkText && linkHref
              ? `<p style="margin:12px 0 0;"><a href="${linkHref}" style="color:${emailTheme.brandDark};font-size:14px;font-weight:700;text-decoration:none;">${escapeHtml(linkText)} &rarr;</a></p>`
              : ""
          }
        </td>
      </tr>
    </table>
  `;
}

/** Full-width green hero banner with hosted illustration image */
export function emailHeroBanner(options: {
  image: string;
  imageWidth?: number;
  imageHeight?: number;
  alt?: string;
  /** Reduce padding for a more compact layout */
  compact?: boolean;
}): string {
  const { image, imageWidth = 200, imageHeight = 150, alt = "OKrunit", compact = false } = options;
  const padding = compact ? "24px 32px" : "40px 32px";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${emailTheme.heroBg};border-bottom:1px solid ${emailTheme.heroBorder};">
      <tr>
        <td align="center" style="padding:${padding};">
          <img
            src="${PROD_URL}/email/${image}"
            alt="${escapeHtml(alt)}"
            width="${imageWidth}"
            height="${imageHeight}"
            style="display:block;width:${imageWidth}px;height:auto;max-height:${imageHeight}px;border:0;"
          />
        </td>
      </tr>
    </table>
  `;
}

/** Reusable icon circle with hosted image */
export function emailIconCircle(
  image: string,
  options: { tone?: EmailTone; size?: number } = {},
): string {
  const { tone = "brand", size = 48 } = options;
  const palette = tonePalette(tone);
  const radius = Math.round(size / 2);
  const imgSize = Math.round(size * 0.6);

  return `<div style="width:${size}px;height:${size}px;border-radius:${radius}px;background:${palette.background};border:2px solid ${palette.border};text-align:center;line-height:${size}px;"><img src="${PROD_URL}/email/${image}" alt="" width="${imgSize}" height="${imgSize}" style="display:inline-block;width:${imgSize}px;height:${imgSize}px;vertical-align:middle;border:0;" /></div>`;
}

/** Stat block for digest / overview emails */
export function emailStatBlock(options: {
  value: string | number;
  label: string;
  tone?: EmailTone;
}): string {
  const { value, label, tone = "neutral" } = options;
  const palette = tonePalette(tone);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${palette.background};border:1px solid ${palette.border};border-radius:14px;">
      <tr>
        <td style="padding:20px 22px 18px;">
          <p style="margin:0;color:${palette.text};font-size:28px;font-weight:700;line-height:30px;letter-spacing:-0.5px;">
            ${value}
          </p>
          <p style="margin:10px 0 0;color:${emailTheme.muted};font-size:11px;font-weight:700;line-height:16px;letter-spacing:1px;text-transform:uppercase;">
            ${escapeHtml(label)}
          </p>
        </td>
      </tr>
    </table>
  `;
}

/** Progress bar for usage / capacity display */
export function emailProgressBar(options: {
  percent: number;
  color?: string;
  height?: number;
}): string {
  const { percent, color = emailTheme.brand, height = 8 } = options;
  const clamped = Math.min(Math.max(percent, 0), 100);

  return `
    <div style="height:${height}px;border-radius:999px;background:${emailTheme.divider};overflow:hidden;">
      <div style="height:${height}px;border-radius:999px;background:${color};width:${clamped}%;"></div>
    </div>
  `;
}

/** Personal sign-off block (like "Here's to your success, -Shona") */
export function emailSignoff(options: {
  message?: string;
  name: string;
  title: string;
  align?: "left" | "center";
}): string {
  const { message, name, title: role, align = "left" } = options;
  const textAlign = align === "center" ? "text-align:center;" : "";
  const alignAttr = align === "center" ? ' align="center"' : "";

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:28px 0 0;border-top:1px solid ${emailTheme.divider};padding-top:20px;">
      <tr>
        <td${alignAttr}>
          ${message ? `<p style="margin:0 0 20px;color:${emailTheme.text};font-size:15px;line-height:26px;${textAlign}">${message}</p>` : ""}
          <p style="margin:0;color:${emailTheme.ink};font-size:15px;font-weight:700;line-height:22px;${textAlign}">${escapeHtml(name)}</p>
          <p style="margin:2px 0 0;color:${emailTheme.muted};font-size:13px;line-height:20px;${textAlign}">${escapeHtml(role)}</p>
        </td>
      </tr>
    </table>
  `;
}

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export function emailLayout(options: {
  body: string;
  /** Optional hero banner that renders ABOVE the white card */
  heroBanner?: string;
  footerText?: string;
  preheader?: string;
}): string {
  const { body, heroBanner, footerText, preheader } = options;

  const preheaderBlock = preheader
    ? `<div style="display:none;font-size:1px;color:${emailTheme.pageBackground};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : "";

  const footerContent =
    footerText ??
    "You received this email because you have an OKrunit account.";

  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <title>OKrunit</title>
</head>
<body style="margin:0;padding:0;background-color:${emailTheme.pageBackground};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;">
  ${preheaderBlock}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;background-color:${emailTheme.pageBackground};">
    <tr>
      <td align="center" style="padding:40px 16px 64px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Logo -->
          <tr>
            <td align="center" style="padding:0 0 28px;">
              <a href="${PROD_URL}" style="text-decoration:none;">
                <img
                  src="${LOGO_URL}"
                  alt="OKrunit"
                  width="140"
                  style="display:block;width:140px;height:auto;border:0;"
                />
              </a>
            </td>
          </tr>

          <!-- Main card -->
          <tr>
            <td>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${emailTheme.cardBackground};border:1px solid ${emailTheme.cardBorder};border-radius:16px;overflow:hidden;">
                ${heroBanner ?? ""}
                <!-- Body content -->
                <tr>
                  <td style="padding:44px 44px 28px;">
                    ${body}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:16px 20px 0;">
              <p style="margin:0 0 10px;color:${emailTheme.muted};font-size:13px;line-height:22px;">
                ${escapeHtml(footerContent)}
              </p>
              <p style="margin:0;color:${emailTheme.subtle};font-size:12px;line-height:22px;">
                <a href="${PROD_URL}" style="color:${emailTheme.brandDark};font-weight:600;text-decoration:none;">Dashboard</a>
                &nbsp;&middot;&nbsp;
                <a href="${PROD_URL}/docs" style="color:${emailTheme.brandDark};font-weight:600;text-decoration:none;">Docs</a>
                &nbsp;&middot;&nbsp;
                <a href="${PROD_URL}/settings" style="color:${emailTheme.brandDark};font-weight:600;text-decoration:none;">Settings</a>
              </p>
              <p style="margin:12px 0 0;color:${emailTheme.subtle};font-size:11px;line-height:18px;">
                OKrunit &middot; Human approval for every automation
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
