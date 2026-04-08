// ---------------------------------------------------------------------------
// OKrunit -- Discord Error Alerts
// ---------------------------------------------------------------------------
// Sends formatted error embeds to a Discord webhook channel.
// Rate-limited per fingerprint to prevent spam.
// ---------------------------------------------------------------------------

import type { ErrorSeverity } from "./types";

const SEVERITY_COLORS: Record<ErrorSeverity, number> = {
  fatal: 0xed4245,   // red
  error: 0xed4245,   // red
  warning: 0xf0883e, // orange
  info: 0x5865f2,    // blurple
};

// In-memory dedup: track last alert time per fingerprint
const lastAlertTimes = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const MAX_TRACKED = 1000;

interface ErrorAlertParams {
  issueId: string;
  fingerprint: string;
  title: string;
  severity: ErrorSeverity;
  stackSnippet: string;
  service?: string;
  requestUrl?: string;
  correlationId?: string;
  userId?: string;
  userName?: string;
  orgId?: string;
  orgName?: string;
  isRegression: boolean;
  eventCount: number;
}

export async function sendErrorDiscordAlert(
  params: ErrorAlertParams,
): Promise<void> {
  const webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL;
  if (!webhookUrl) return;

  // Rate limit: skip if we alerted for this fingerprint recently
  const now = Date.now();
  const lastAlert = lastAlertTimes.get(params.fingerprint);
  if (lastAlert && now - lastAlert < ALERT_COOLDOWN_MS) return;

  // LRU eviction if map is too large
  if (lastAlertTimes.size >= MAX_TRACKED) {
    const oldest = [...lastAlertTimes.entries()].sort(
      (a, b) => a[1] - b[1],
    )[0];
    if (oldest) lastAlertTimes.delete(oldest[0]);
  }
  lastAlertTimes.set(params.fingerprint, now);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://okrunit.com";
  const prefix = params.isRegression ? "Regression" : "New Error";

  // Build concise fields. Stack traces are available on the admin page,
  // so we keep the Discord embed short and actionable.
  const fields: { name: string; value: string; inline: boolean }[] = [
    { name: "Severity", value: params.severity.toUpperCase(), inline: true },
    ...(params.service
      ? [{ name: "Service", value: params.service, inline: true }]
      : []),
    ...(params.eventCount > 1
      ? [{ name: "Count", value: String(params.eventCount), inline: true }]
      : []),
    ...(params.correlationId
      ? [{ name: "Correlation ID", value: `\`${params.correlationId}\``, inline: false }]
      : []),
    ...(params.requestUrl
      ? [{ name: "URL", value: params.requestUrl, inline: false }]
      : []),
    ...(params.userId
      ? [
          {
            name: "User",
            value: params.userName
              ? `${params.userName} (\`${params.userId.slice(0, 8)}...\`)`
              : `\`${params.userId.slice(0, 8)}...\``,
            inline: true,
          },
        ]
      : []),
    ...(params.orgId
      ? [
          {
            name: "Org",
            value: params.orgName
              ? `${params.orgName} (\`${params.orgId.slice(0, 8)}...\`)`
              : `\`${params.orgId.slice(0, 8)}...\``,
            inline: true,
          },
        ]
      : []),
  ];

  const adminUrl = `${appUrl}/admin/errors/${params.issueId}`;

  const payload = {
    embeds: [
      {
        title: `${prefix}: ${params.title.slice(0, 100)}`,
        description: `[View details in admin dashboard](${adminUrl})`,
        color: SEVERITY_COLORS[params.severity] ?? SEVERITY_COLORS.error,
        fields,
        footer: { text: `Fingerprint: ${params.fingerprint.slice(0, 16)}` },
        timestamp: new Date().toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5, // Link button
            label: "View in Dashboard",
            url: adminUrl,
          },
        ],
      },
    ],
  };

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Never let alert failures propagate
    console.error("[ErrorMonitor] Failed to send Discord alert");
  }
}
