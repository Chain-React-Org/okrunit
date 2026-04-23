// ---------------------------------------------------------------------------
// OKrunit -- Approval message reference persistence + edit-on-decide
// ---------------------------------------------------------------------------
// Stores platform-native message ids when we send an approval notification
// to Discord or Telegram, then edits those messages in place when the
// approval is decided so the Approve/Reject buttons are replaced with the
// outcome. Slack and Teams don't support webhook-based message editing;
// the stale-click cleanup flow handles those separately.
// ---------------------------------------------------------------------------

import { createAdminClient } from "@/lib/supabase/admin";
import { logger } from "@/lib/monitoring/logger";
import { editMessage as editTelegramMessage } from "@/lib/notifications/channels/telegram";
import { editDiscordWebhookMessage } from "@/lib/notifications/channels/discord";
import { updateSlackBotMessage } from "@/lib/notifications/channels/slack";

export interface ApprovalMessageRef {
  id: string;
  approval_id: string;
  org_id: string;
  connection_id: string | null;
  platform: "slack" | "teams" | "discord" | "telegram";
  channel_id: string | null;
  message_id: string | null;
  webhook_url: string | null;
}

export async function recordApprovalMessage(params: {
  approvalId: string;
  orgId: string;
  connectionId: string | null;
  platform: ApprovalMessageRef["platform"];
  channelId: string | null;
  messageId: string | null;
  webhookUrl: string | null;
}): Promise<void> {
  if (!params.messageId) return;
  const admin = createAdminClient();
  const { error } = await admin.from("approval_messages").insert({
    approval_id: params.approvalId,
    org_id: params.orgId,
    connection_id: params.connectionId,
    platform: params.platform,
    channel_id: params.channelId,
    message_id: params.messageId,
    webhook_url: params.webhookUrl,
  });
  if (error) {
    logger.warn(`[ApprovalMessages] insert failed: ${error.message}`);
  }
}

/**
 * Edit every recorded message for this approval to reflect the decision.
 * Called from the approval decide path after the status flips to approved
 * or rejected. Errors are swallowed and logged — a failed edit should never
 * unwind the decision itself.
 */
export async function editApprovalMessagesOnDecide(params: {
  approvalId: string;
  title: string;
  decision: "approved" | "rejected" | "cancelled" | "expired";
  decidedByName?: string;
  comment?: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { data: refs } = await admin
    .from("approval_messages")
    .select("id, platform, channel_id, message_id, webhook_url, connection_id")
    .eq("approval_id", params.approvalId);

  if (!refs || refs.length === 0) return;

  // Slack edits need the bot token from the connection row. Collect unique
  // connection ids up front and fetch their tokens in one query.
  const slackConnIds = Array.from(
    new Set(
      refs
        .filter((r) => r.platform === "slack" && r.connection_id)
        .map((r) => r.connection_id as string),
    ),
  );
  let botTokens: Record<string, string | null> = {};
  if (slackConnIds.length > 0) {
    const { data: conns } = await admin
      .from("messaging_connections")
      .select("id, bot_token")
      .in("id", slackConnIds);
    botTokens = Object.fromEntries(
      (conns ?? []).map((c) => [c.id, c.bot_token]),
    );
  }

  for (const ref of refs) {
    try {
      if (ref.platform === "telegram" && ref.channel_id && ref.message_id) {
        // editMessage() reads the bot token from env. A per-connection bot
        // token override isn't supported here yet — most orgs use a single
        // bot so this is fine in practice.
        const summary = formatTelegramSummary(params);
        await editTelegramMessage(
          ref.channel_id,
          Number(ref.message_id),
          summary,
          undefined,
          true,
        );
      } else if (ref.platform === "discord" && ref.webhook_url && ref.message_id) {
        await editDiscordWebhookMessage({
          webhookUrl: ref.webhook_url,
          messageId: ref.message_id,
          title: params.title,
          decision: params.decision,
          decidedBy: params.decidedByName,
          comment: params.comment,
        });
      } else if (
        ref.platform === "slack" &&
        ref.channel_id &&
        ref.message_id &&
        ref.connection_id
      ) {
        const botToken = botTokens[ref.connection_id];
        if (!botToken) {
          // Legacy webhook-only install — stale-click cleanup handles it.
          continue;
        }
        await updateSlackBotMessage({
          botToken,
          channelId: ref.channel_id,
          ts: ref.message_id,
          title: params.title,
          decision: params.decision,
          decidedBy: params.decidedByName,
          comment: params.comment,
        });
      }
      // Teams edits still require Bot Framework (deferred).
    } catch (err) {
      logger.warn(
        `[ApprovalMessages] Edit failed for ${ref.platform} ref ${ref.id}:`,
        err,
      );
    }
  }
}

function formatTelegramSummary(params: {
  title: string;
  decision: "approved" | "rejected" | "cancelled" | "expired";
  decidedByName?: string;
  comment?: string;
}): string {
  const escape = (s: string) =>
    s.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
  const badge =
    params.decision === "approved"
      ? "\u2705 *Approved*"
      : params.decision === "rejected"
        ? "\u274C *Rejected*"
        : params.decision === "cancelled"
          ? "\uD83D\uDEAB *Cancelled*"
          : "\u231B *Expired*";
  const byLine = params.decidedByName
    ? ` by ${escape(params.decidedByName)}`
    : "";
  const commentLine = params.comment
    ? `\n\n_${escape(params.comment)}_`
    : "";
  return `${badge}: *${escape(params.title)}*${byLine}${commentLine}`;
}
