// ---------------------------------------------------------------------------
// OKrunit -- Error Rate Spike Detection
// ---------------------------------------------------------------------------
// Compares error count in the last 15 minutes vs the same window in the
// previous hour. If the rate exceeds the threshold, sends a Discord alert.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";

const SPIKE_THRESHOLD = 3; // 3x normal rate triggers alert
const WINDOW_MINUTES = 15;

// In-memory cooldown to prevent repeated spike alerts
let lastSpikeAlertAt = 0;
const SPIKE_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

export async function checkErrorRateSpike(): Promise<{
  spikeDetected: boolean;
  recentCount: number;
  baselineCount: number;
  ratio: number;
}> {
  const admin = createAdminClient();
  const now = new Date();

  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60 * 1000).toISOString();
  const baselineStart = new Date(now.getTime() - 75 * 60 * 1000).toISOString(); // 1h15m ago
  const baselineEnd = new Date(now.getTime() - 60 * 60 * 1000).toISOString(); // 1h ago

  const [{ count: recentCount }, { count: baselineCount }] = await Promise.all([
    admin
      .from("error_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", windowStart),
    admin
      .from("error_events")
      .select("id", { count: "exact", head: true })
      .gte("created_at", baselineStart)
      .lt("created_at", baselineEnd),
  ]);

  const recent = recentCount ?? 0;
  const baseline = baselineCount ?? 0;

  // Need at least 3 errors in recent window and a baseline to compare against
  const ratio = baseline > 0 ? recent / baseline : recent > 2 ? recent : 0;
  const spikeDetected = ratio >= SPIKE_THRESHOLD && recent >= 3;

  if (spikeDetected) {
    const nowMs = Date.now();
    if (nowMs - lastSpikeAlertAt < SPIKE_COOLDOWN_MS) {
      return { spikeDetected: true, recentCount: recent, baselineCount: baseline, ratio };
    }
    lastSpikeAlertAt = nowMs;

    await sendSpikeAlert(recent, baseline, ratio).catch(() => {});
  }

  return { spikeDetected, recentCount: recent, baselineCount: baseline, ratio };
}

async function sendSpikeAlert(
  recentCount: number,
  baselineCount: number,
  ratio: number,
): Promise<void> {
  const webhookUrl = process.env.DISCORD_ERROR_WEBHOOK_URL;
  if (!webhookUrl) return;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://okrunit.com";

  const payload = {
    embeds: [
      {
        title: "Error Rate Spike Detected",
        description: `Error rate is **${ratio.toFixed(1)}x** higher than normal in the last 15 minutes.`,
        color: 0xed4245, // red
        fields: [
          { name: "Last 15 min", value: String(recentCount), inline: true },
          { name: "Baseline (1h ago)", value: String(baselineCount), inline: true },
          { name: "Multiplier", value: `${ratio.toFixed(1)}x`, inline: true },
        ],
        footer: { text: "Spike detection runs every 5 minutes" },
        timestamp: new Date().toISOString(),
      },
    ],
    components: [
      {
        type: 1,
        components: [
          {
            type: 2,
            style: 5,
            label: "View Errors",
            url: `${appUrl}/admin/errors`,
          },
        ],
      },
    ],
  };

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
