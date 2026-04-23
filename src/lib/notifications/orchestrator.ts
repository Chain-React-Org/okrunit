// ---------------------------------------------------------------------------
// OKrunit -- Notification Orchestrator
// ---------------------------------------------------------------------------
//
// Central fan-out for all notification channels (web push, email, SMS, Slack,
// Teams, Telegram, Discord, generic webhooks).
//
// Usage:
//   import { dispatchNotifications } from "@/lib/notifications/orchestrator";
//   await dispatchNotifications({ type: "approval.created", ... });
//
// Per-user channels: email, web push, SMS (controlled by notification_settings).
// Org-wide channels: Slack, Teams, Telegram, Discord (controlled by
// messaging_connections table).
// Org-wide webhooks: generic HTTP webhook channels (controlled by
// webhook_notification_channels table).
// ---------------------------------------------------------------------------

import { logger } from "@/lib/monitoring/logger";
import type { NotificationEvent, NotificationEventType } from "@/lib/notifications/types";
import {
  shouldNotify,
  getOrgNotificationSettings,
} from "@/lib/notifications/filters";
import { sendWebPush } from "@/lib/notifications/channels/web-push";
import {
  sendApprovalEmail,
  sendDecisionEmail,
} from "@/lib/notifications/channels/email";
import {
  sendSlackNotification,
  sendSlackDecisionNotification,
} from "@/lib/notifications/channels/slack";
import {
  sendTeamsNotification,
  sendTeamsDecisionNotification,
} from "@/lib/notifications/channels/teams";
import {
  sendTelegramNotification,
  sendTelegramDecisionNotification,
} from "@/lib/notifications/channels/telegram";
import {
  sendDiscordNotification,
  sendDiscordDecisionNotification,
} from "@/lib/notifications/channels/discord";
import { sendSms, isTwilioConfigured } from "@/lib/notifications/channels/sms";
import {
  getOrgWebhookChannels,
  sendWebhookNotification,
} from "@/lib/notifications/channels/webhook";
import type { WebhookNotificationPayload } from "@/lib/notifications/channels/webhook";
import { generateActionTokens } from "@/lib/notifications/tokens";
import { getOrgMessagingConnections } from "@/lib/notifications/messaging";
import type { NotificationSettings, MessagingConnection, RoutingRules } from "@/lib/types/database";
import type { PushPayload } from "@/lib/notifications/channels/web-push";
import { PRIORITY_ORDER } from "@/lib/constants";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrgPlan } from "@/lib/billing/enforce";
import { hasFeature } from "@/lib/billing/plans";
import { logNotificationDelivery, logNotificationDeliveryBatch } from "@/lib/notifications/delivery-log";
import type { DeliveryLogEntry } from "@/lib/notifications/delivery-log";

// ---------------------------------------------------------------------------
// Default settings applied when a user has not configured preferences
// ---------------------------------------------------------------------------

const DEFAULT_SETTINGS: Pick<
  NotificationSettings,
  | "email_enabled"
  | "push_enabled"
  | "quiet_hours_enabled"
  | "quiet_hours_start"
  | "quiet_hours_end"
  | "quiet_hours_timezone"
  | "minimum_priority"
> = {
  email_enabled: false,
  push_enabled: false,
  quiet_hours_enabled: false,
  quiet_hours_start: null,
  quiet_hours_end: null,
  quiet_hours_timezone: "UTC",
  minimum_priority: "low",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Dispatch notifications for a lifecycle event to every relevant org member
 * across all enabled channels.
 *
 * Flow:
 *  1. Load all org members and their notification settings (for email + push).
 *  2. Load all org messaging connections (for Slack, Teams, Telegram, Discord).
 *  3. For each member, check `shouldNotify` (quiet hours + priority).
 *  4. Fan out to enabled per-user channels (web push, email) in parallel.
 *  5. Fan out to org-wide messaging connections in parallel.
 *
 * This function **never throws**. Individual channel failures are logged but
 * do not prevent other channels or other users from receiving their
 * notifications (thanks to `Promise.allSettled`).
 */
export async function dispatchNotifications(
  event: NotificationEvent,
): Promise<void> {
  try {
    // Resolve decidedBy from user ID to display name if it looks like a UUID
    if (event.decidedBy && isUuid(event.decidedBy)) {
      event = { ...event, decidedBy: await resolveUserName(event.decidedBy) };
    }

    // Load per-user settings, org-wide messaging connections, and webhook
    // channels in parallel
    const [orgUsers, messagingConnections, webhookChannels, orgPlan] =
      await Promise.all([
        getOrgNotificationSettings(event.orgId),
        getOrgMessagingConnections(event.orgId),
        getOrgWebhookChannels(event.orgId),
        getOrgPlan(event.orgId),
      ]);

    // Feature checks for gated channels
    const smsAllowed =
      isTwilioConfigured() && hasFeature(orgPlan, "webhook_notifications");
    const webhooksAllowed = hasFeature(orgPlan, "webhook_notifications");

    // If targeted, only notify specific users
    let recipients = orgUsers;
    if (event.targetUserIds && event.targetUserIds.length > 0) {
      recipients = orgUsers.filter(u => event.targetUserIds!.includes(u.userId));
    }

    const promises: Promise<void>[] = [];
    const suppressionLogs: DeliveryLogEntry[] = [];

    // -- Per-user channels (email + web push + SMS) ----------------------------
    // Pre-load phone numbers for SMS if SMS is available
    let phoneMap: Map<string, string> | null = null;
    if (smsAllowed) {
      phoneMap = await loadUserPhoneNumbers(
        recipients.map((r) => r.userId),
      );
    }

    for (const { userId, email, settings } of recipients) {
      const effective = settings ?? (DEFAULT_SETTINGS as NotificationSettings);

      // Gate: quiet hours + priority threshold
      if (!shouldNotify(effective, event.requestPriority)) {
        const reason = getSuppressionReason(effective, event.requestPriority);
        if (effective.push_enabled) {
          suppressionLogs.push({
            orgId: event.orgId,
            requestId: event.requestId,
            recipientUserId: userId,
            channel: "web_push",
            status: "suppressed",
            suppressionReason: reason,
          });
        }
        if (effective.email_enabled) {
          suppressionLogs.push({
            orgId: event.orgId,
            requestId: event.requestId,
            recipientUserId: userId,
            channel: "email",
            status: "suppressed",
            suppressionReason: reason,
          });
        }
        if (effective.sms_enabled && smsAllowed) {
          suppressionLogs.push({
            orgId: event.orgId,
            requestId: event.requestId,
            recipientUserId: userId,
            channel: "sms",
            status: "suppressed",
            suppressionReason: reason,
          });
        }
        continue;
      }

      // -- Web Push -----------------------------------------------------------
      if (effective.push_enabled) {
        const pushPayload: PushPayload = {
          title: getNotificationTitle(event),
          body: getNotificationBody(event),
          url: "/org/overview",
          requestId: event.requestId,
          tag: `gk-${event.requestId}`,
        };
        promises.push(
          sendWebPush(userId, pushPayload)
            .then(() => {
              logNotificationDelivery({
                orgId: event.orgId,
                requestId: event.requestId,
                recipientUserId: userId,
                channel: "web_push",
                status: "sent",
              });
            })
            .catch((err: unknown) => {
              logger.error(
                `[Notifications] Web push failed for user ${userId}:`,
                err,
              );
              logNotificationDelivery({
                orgId: event.orgId,
                requestId: event.requestId,
                recipientUserId: userId,
                channel: "web_push",
                status: "failed",
                errorMessage: err instanceof Error ? err.message : String(err),
              });
            }),
        );
      }

      // -- Email --------------------------------------------------------------
      if (effective.email_enabled) {
        if (event.type === "approval.created" || event.type === "approval.next_approver") {
          const emailPromise = generateActionTokens(
            event.requestId,
            userId,
          ).then((tokens: { approveToken: string; rejectToken: string }) =>
            sendApprovalEmail({
              to: email,
              subject: event.requestTitle,
              requestId: event.requestId,
              title: event.requestTitle,
              description: event.requestDescription,
              priority: event.requestPriority,
              approveToken: tokens.approveToken,
              rejectToken: tokens.rejectToken,
            }),
          );
          promises.push(
            emailPromise
              .then(() => {
                logNotificationDelivery({
                  orgId: event.orgId,
                  requestId: event.requestId,
                  recipientUserId: userId,
                  channel: "email",
                  status: "sent",
                  metadata: { to: email },
                });
              })
              .catch((err: unknown) => {
                logger.error(
                  `[Notifications] Approval email failed for ${email}:`,
                  err,
                );
                logNotificationDelivery({
                  orgId: event.orgId,
                  requestId: event.requestId,
                  recipientUserId: userId,
                  channel: "email",
                  status: "failed",
                  errorMessage: err instanceof Error ? err.message : String(err),
                  metadata: { to: email },
                });
              }),
          );
        } else {
          const decision = extractDecision(event.type);
          promises.push(
            sendDecisionEmail({
              to: email,
              subject: `${event.requestTitle} - ${decision}`,
              requestTitle: event.requestTitle,
              decision,
              decidedBy: event.decidedBy,
              comment: event.decisionComment,
            })
              .then(() => {
                logNotificationDelivery({
                  orgId: event.orgId,
                  requestId: event.requestId,
                  recipientUserId: userId,
                  channel: "email",
                  status: "sent",
                  metadata: { to: email },
                });
              })
              .catch((err: unknown) => {
                logger.error(
                  `[Notifications] Decision email failed for ${email}:`,
                  err,
                );
                logNotificationDelivery({
                  orgId: event.orgId,
                  requestId: event.requestId,
                  recipientUserId: userId,
                  channel: "email",
                  status: "failed",
                  errorMessage: err instanceof Error ? err.message : String(err),
                  metadata: { to: email },
                });
              }),
          );
        }
      }

      // -- SMS ----------------------------------------------------------------
      if (smsAllowed && effective.sms_enabled) {
        const phone = phoneMap?.get(userId);
        if (phone) {
          const smsBody = buildSmsBody(event);
          promises.push(
            sendSms({ to: phone, body: smsBody })
              .then((result) => {
                logNotificationDelivery({
                  orgId: event.orgId,
                  requestId: event.requestId,
                  recipientUserId: userId,
                  channel: "sms",
                  status: "sent",
                  externalId: result?.sid,
                  metadata: { to: phone },
                });
              })
              .catch((err: unknown) => {
                logger.error(
                  `[Notifications] SMS failed for user ${userId}:`,
                  err,
                );
                logNotificationDelivery({
                  orgId: event.orgId,
                  requestId: event.requestId,
                  recipientUserId: userId,
                  channel: "sms",
                  status: "failed",
                  errorMessage: err instanceof Error ? err.message : String(err),
                  metadata: { to: phone },
                });
              }),
          );
        }
      }
    }

    // -- Org-wide messaging connections (Slack, Teams, Telegram, Discord) ------
    // Pre-load team membership data for DM filtering (only if needed, once).
    // We do this outside the loop to avoid N+1 queries per connection.
    let teamMemberIds: Set<string> | null = null;

    for (const conn of messagingConnections) {
      // ---- Filter 1: Per-request channel targeting ----
      // If the event specifies exact channel IDs, only deliver to those.
      if (
        event.notifyChannelIds &&
        event.notifyChannelIds.length > 0 &&
        !event.notifyChannelIds.includes(conn.id)
      ) {
        continue;
      }

      // ---- Filter 2: Routing rules on the connection ----
      // If the connection has routing rules configured, check them.
      // Only apply routing rules when no per-request targeting was used.
      if (
        !(event.notifyChannelIds && event.notifyChannelIds.length > 0) &&
        !passesRoutingRules(conn.routing_rules, event)
      ) {
        continue;
      }

      // ---- Filter 3: User-level DM filtering ----
      // For personal/DM channels, only notify the people who can act right
      // now. For sequential flows that's just the current-turn approver —
      // everyone else in the chain gets pinged when it becomes their turn
      // via the approval.next_approver event. For parallel flows it's any
      // assigned approver. No assigned approvers falls through to broadcast.
      if (isDmChannel(conn) && conn.installed_by) {
        const hasAssignedApprovers =
          event.assignedApprovers && event.assignedApprovers.length > 0;
        const hasAssignedTeam = !!event.assignedTeamId;

        if (hasAssignedApprovers || hasAssignedTeam) {
          let userIsTarget = false;

          if (hasAssignedApprovers) {
            if (event.isSequential && event.currentTurnUserId) {
              // Sequential: only the current-turn approver (or their
              // active delegate) gets a DM ping at this moment.
              userIsTarget = conn.installed_by === event.currentTurnUserId;
            } else {
              userIsTarget = event.assignedApprovers!.includes(conn.installed_by);
            }
          }

          if (!userIsTarget && hasAssignedTeam) {
            if (teamMemberIds === null) {
              teamMemberIds = await loadTeamMemberIds(event.assignedTeamId!);
            }
            userIsTarget = teamMemberIds.has(conn.installed_by);
          }

          if (!userIsTarget) {
            continue;
          }
        }
        // If no assigned approvers/team, broadcast to all (including DMs)
      }

      // ---- Existing filters: priority + event type ----
      if (!meetsMinimumPriority(event.requestPriority, conn.priority_filter)) {
        continue;
      }

      const isCreateEvent =
        event.type === "approval.created" ||
        event.type === "approval.next_approver" ||
        event.type === "approval.sla_warning" ||
        event.type === "approval.sla_breached" ||
        event.type === "approval.bottleneck" ||
        event.type === "approval.escalated";
      const isDecisionEvent =
        event.type === "approval.approved" ||
        event.type === "approval.rejected" ||
        event.type === "approval.cancelled" ||
        event.type === "approval.expired";

      if (isCreateEvent && !conn.notify_on_create) continue;
      if (isDecisionEvent && !conn.notify_on_decide) continue;

      // Dispatch based on platform
      const channelPromise = dispatchToMessagingConnection(conn, event);
      if (channelPromise) {
        promises.push(channelPromise);
      }
    }

    // -- Generic webhook channels ---------------------------------------------
    if (webhooksAllowed && webhookChannels.length > 0) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const eventName = mapEventToWebhookEvent(event.type);

      for (const channel of webhookChannels) {
        // Check if the channel is subscribed to this event type
        if (
          channel.events.length > 0 &&
          !channel.events.includes(eventName) &&
          !channel.events.includes("*")
        ) {
          continue;
        }

        const payload: WebhookNotificationPayload = {
          event_type: event.type,
          request_id: event.requestId,
          title: event.requestTitle,
          description: event.requestDescription,
          priority: event.requestPriority,
          action_type: event.actionType,
          status: extractDecision(event.type),
          approve_url: `${appUrl}/api/v1/approvals/${event.requestId}/approve`,
          reject_url: `${appUrl}/api/v1/approvals/${event.requestId}/reject`,
          dashboard_url: `${appUrl}/org/overview`,
          decided_by: event.decidedBy,
          decision_comment: event.decisionComment,
          timestamp: new Date().toISOString(),
        };

        const logBase = {
          orgId: event.orgId,
          requestId: event.requestId,
          channel: "webhook" as const,
          metadata: {
            webhookChannelId: channel.id,
            webhookChannelName: channel.name,
          },
        };

        promises.push(
          sendWebhookNotification(channel, payload)
            .then(() => {
              logNotificationDelivery({ ...logBase, status: "sent" });
            })
            .catch((err: unknown) => {
              logger.error(
                `[Notifications] Webhook failed for channel ${channel.id} (${channel.name}):`,
                err,
              );
              logNotificationDelivery({
                ...logBase,
                status: "failed",
                errorMessage: err instanceof Error ? err.message : String(err),
              });
            }),
        );
      }
    }

    await Promise.allSettled(promises);

    // Flush suppression logs in a single batch (fire-and-forget)
    if (suppressionLogs.length > 0) {
      logNotificationDeliveryBatch(suppressionLogs);
    }
  } catch (error) {
    logger.error("[Notifications] Orchestrator error:", error);
  }
}

// ---------------------------------------------------------------------------
// Messaging Connection Dispatcher
// ---------------------------------------------------------------------------

function dispatchToMessagingConnection(
  conn: MessagingConnection,
  event: NotificationEvent,
): Promise<void> | null {
  const isCreateEvent =
    event.type === "approval.created" || event.type === "approval.next_approver";

  switch (conn.platform) {
    case "slack":
      return dispatchSlack(conn, event, isCreateEvent);
    case "discord":
      return dispatchDiscord(conn, event, isCreateEvent);
    case "teams":
      return dispatchTeams(conn, event, isCreateEvent);
    case "telegram":
      return dispatchTelegram(conn, event, isCreateEvent);
    default:
      return null;
  }
}

function dispatchSlack(
  conn: MessagingConnection,
  event: NotificationEvent,
  isCreateEvent: boolean,
): Promise<void> {
  const webhookUrl = conn.webhook_url;
  if (!webhookUrl) return Promise.resolve();

  const logBase = {
    orgId: event.orgId,
    requestId: event.requestId,
    channel: "slack" as const,
    metadata: { connectionId: conn.id, connectionName: conn.channel_name },
  };

  if (isCreateEvent) {
    return sendSlackNotification({
      webhookUrl,
      requestId: event.requestId,
      title: event.requestTitle,
      description: event.requestDescription,
      priority: event.requestPriority,
      connectionName: event.connectionName,
    })
      .then(() => {
        logNotificationDelivery({ ...logBase, status: "sent" });
      })
      .catch((err: unknown) => {
        logger.error(
          `[Notifications] Slack notification failed for connection ${conn.id}:`,
          err,
        );
        logNotificationDelivery({
          ...logBase,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });
  }

  const decision = extractDecision(event.type);
  return sendSlackDecisionNotification({
    webhookUrl,
    requestTitle: event.requestTitle,
    decision,
    decidedBy: event.decidedBy,
    comment: event.decisionComment,
  })
    .then(() => {
      logNotificationDelivery({ ...logBase, status: "sent" });
    })
    .catch((err: unknown) => {
      logger.error(
        `[Notifications] Slack decision failed for connection ${conn.id}:`,
        err,
      );
      logNotificationDelivery({
        ...logBase,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });
}

async function dispatchDiscord(
  conn: MessagingConnection,
  event: NotificationEvent,
  isCreateEvent: boolean,
): Promise<void> {
  const webhookUrl = conn.webhook_url ?? undefined;
  const channelId = conn.channel_id ?? undefined;

  // Skip if channel hasn't been selected yet
  if (channelId?.startsWith("pending:")) return;

  // Refresh token if needed (uses DISCORD_BOT_TOKEN env if available)
  const { ensureDiscordToken } = await import("@/lib/notifications/token-refresh");
  const botToken = await ensureDiscordToken(conn) ?? undefined;

  // Skip if no valid delivery method
  if (!webhookUrl && !(botToken && channelId)) return;

  const logBase = {
    orgId: event.orgId,
    requestId: event.requestId,
    channel: "discord" as const,
    metadata: { connectionId: conn.id, connectionName: conn.channel_name },
  };

  if (isCreateEvent) {
    return sendDiscordNotification({
      webhookUrl,
      botToken,
      channelId,
      requestId: event.requestId,
      title: event.requestTitle,
      description: event.requestDescription,
      priority: event.requestPriority,
      connectionName: event.connectionName,
    })
      .then(() => {
        logNotificationDelivery({ ...logBase, status: "sent" });
      })
      .catch((err: unknown) => {
        logger.error(
          `[Notifications] Discord notification failed for connection ${conn.id}:`,
          err,
        );
        logNotificationDelivery({
          ...logBase,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });
  }

  const decision = extractDecision(event.type);
  return sendDiscordDecisionNotification({
    webhookUrl,
    botToken,
    channelId,
    requestTitle: event.requestTitle,
    decision,
    decidedBy: event.decidedBy,
    comment: event.decisionComment,
  })
    .then(() => {
      logNotificationDelivery({ ...logBase, status: "sent" });
    })
    .catch((err: unknown) => {
      logger.error(
        `[Notifications] Discord decision failed for connection ${conn.id}:`,
        err,
      );
      logNotificationDelivery({
        ...logBase,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });
}

function dispatchTeams(
  conn: MessagingConnection,
  event: NotificationEvent,
  isCreateEvent: boolean,
): Promise<void> {
  const webhookUrl = conn.webhook_url;
  if (!webhookUrl) return Promise.resolve();

  const logBase = {
    orgId: event.orgId,
    requestId: event.requestId,
    channel: "teams" as const,
    metadata: { connectionId: conn.id, connectionName: conn.channel_name },
  };

  if (isCreateEvent) {
    return sendTeamsNotification({
      webhookUrl,
      requestId: event.requestId,
      title: event.requestTitle,
      description: event.requestDescription,
      priority: event.requestPriority,
      connectionName: event.connectionName,
      orgId: event.orgId,
    })
      .then(() => {
        logNotificationDelivery({ ...logBase, status: "sent" });
      })
      .catch((err: unknown) => {
        logger.error(
          `[Notifications] Teams notification failed for connection ${conn.id}:`,
          err,
        );
        logNotificationDelivery({
          ...logBase,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });
  }

  const decision = extractDecision(event.type);
  return sendTeamsDecisionNotification({
    webhookUrl,
    requestTitle: event.requestTitle,
    decision,
    decidedBy: event.decidedBy,
    comment: event.decisionComment,
  })
    .then(() => {
      logNotificationDelivery({ ...logBase, status: "sent" });
    })
    .catch((err: unknown) => {
      logger.error(
        `[Notifications] Teams decision failed for connection ${conn.id}:`,
        err,
      );
      logNotificationDelivery({
        ...logBase,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });
}

function dispatchTelegram(
  conn: MessagingConnection,
  event: NotificationEvent,
  isCreateEvent: boolean,
): Promise<void> {
  const chatId = conn.channel_id;
  // For Telegram, we need either the connection's bot_token or the env var
  if (!chatId) return Promise.resolve();

  const logBase = {
    orgId: event.orgId,
    requestId: event.requestId,
    channel: "telegram" as const,
    metadata: { connectionId: conn.id, connectionName: conn.channel_name },
  };

  // Only render Approve/Reject buttons when the DM installer is actually
  // the person we need a decision from right now. For group chats (no
  // installed_by) keep the buttons — server-side permission checks reject
  // ineligible clickers with a clear ephemeral error. For DMs where the
  // installer is NOT the current turn approver, drop the buttons so the
  // message reads as an FYI.
  let showActionButtons = true;
  if (conn.installed_by && isCreateEvent) {
    const assigned = event.assignedApprovers ?? [];
    if (assigned.length > 0) {
      if (event.isSequential) {
        // event.currentTurnUserId is pre-computed by the caller; fall back
        // to assigned[0] for create events since no one has voted yet.
        const nextUp = event.currentTurnUserId ?? assigned[0];
        showActionButtons = nextUp === conn.installed_by;
      } else {
        showActionButtons = assigned.includes(conn.installed_by);
      }
    }
    // No assigned approvers on event = any-approver mode; keep buttons.
  }

  if (isCreateEvent) {
    return sendTelegramNotification({
      chatId,
      botToken: conn.bot_token ?? undefined,
      requestId: event.requestId,
      title: event.requestTitle,
      description: event.requestDescription,
      priority: event.requestPriority,
      connectionName: event.connectionName,
      showActionButtons,
    })
      .then(() => {
        logNotificationDelivery({ ...logBase, status: "sent" });
      })
      .catch((err: unknown) => {
        logger.error(
          `[Notifications] Telegram notification failed for connection ${conn.id}:`,
          err,
        );
        logNotificationDelivery({
          ...logBase,
          status: "failed",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });
  }

  const decision = extractDecision(event.type);
  return sendTelegramDecisionNotification({
    chatId,
    botToken: conn.bot_token ?? undefined,
    requestTitle: event.requestTitle,
    decision,
    decidedBy: event.decidedBy,
    comment: event.decisionComment,
  })
    .then(() => {
      logNotificationDelivery({ ...logBase, status: "sent" });
    })
    .catch((err: unknown) => {
      logger.error(
        `[Notifications] Telegram decision failed for connection ${conn.id}:`,
        err,
      );
      logNotificationDelivery({
        ...logBase,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map of event types to human-readable push notification titles. */
const TITLE_MAP: Record<NotificationEventType, string> = {
  "approval.created": "New Approval Request",
  "approval.approved": "Request Approved",
  "approval.rejected": "Request Rejected",
  "approval.cancelled": "Request Cancelled",
  "approval.expired": "Request Expired",
  "approval.comment": "New Comment",
  "approval.next_approver": "Your Approval Needed",
  "approval.execution_cancelled": "Scheduled Execution Cancelled",
  "approval.sla_warning": "SLA Deadline Approaching",
  "approval.sla_breached": "SLA Breached",
  "approval.bottleneck": "Approval Bottleneck Detected",
  "approval.escalated": "Approval Escalated",
};

function getNotificationTitle(event: NotificationEvent): string {
  return TITLE_MAP[event.type] ?? "OKrunit Notification";
}

function getNotificationBody(event: NotificationEvent): string {
  switch (event.type) {
    case "approval.created":
      return `"${event.requestTitle}" needs your review.`;
    case "approval.approved":
      return `"${event.requestTitle}" was approved${event.decidedBy ? ` by ${event.decidedBy}` : ""}.`;
    case "approval.rejected":
      return `"${event.requestTitle}" was rejected${event.decidedBy ? ` by ${event.decidedBy}` : ""}.`;
    case "approval.cancelled":
      return `"${event.requestTitle}" was cancelled.`;
    case "approval.expired":
      return `"${event.requestTitle}" has expired.`;
    case "approval.comment":
      return `New comment on "${event.requestTitle}".`;
    case "approval.next_approver":
      return `Your approval is now needed for "${event.requestTitle}".`;
    case "approval.sla_warning":
      return `"${event.requestTitle}" is approaching its SLA deadline. Act soon to avoid a breach.`;
    case "approval.sla_breached":
      return `"${event.requestTitle}" has breached its SLA deadline.`;
    case "approval.bottleneck":
      return `An approver has too many pending approvals.`;
    case "approval.escalated":
      return `"${event.requestTitle}" has been escalated (level ${event.escalationLevel ?? "?"}) and requires immediate attention.`;
    default:
      return event.requestTitle;
  }
}

function extractDecision(type: NotificationEventType): string {
  return type.split(".")[1] ?? "updated";
}

/**
 * Determine why shouldNotify() returned false for a given user's settings.
 * Used to populate the suppression_reason field in the delivery log.
 */
function getSuppressionReason(
  settings: NotificationSettings,
  priority: string,
): string {
  const eventPriorityOrder =
    PRIORITY_ORDER[priority as keyof typeof PRIORITY_ORDER] ?? 0;
  const minPriorityOrder =
    PRIORITY_ORDER[settings.minimum_priority as keyof typeof PRIORITY_ORDER] ?? 0;

  if (eventPriorityOrder < minPriorityOrder) {
    return "priority_filter";
  }

  if (
    settings.quiet_hours_enabled &&
    settings.quiet_hours_start &&
    settings.quiet_hours_end
  ) {
    return "quiet_hours";
  }

  return "unknown";
}

/**
 * Check if an event's priority meets the minimum priority threshold
 * set on a messaging connection.
 */
function meetsMinimumPriority(
  eventPriority: string,
  minimumPriority: string,
): boolean {
  const eventOrder =
    PRIORITY_ORDER[eventPriority as keyof typeof PRIORITY_ORDER] ?? 0;
  const minOrder =
    PRIORITY_ORDER[minimumPriority as keyof typeof PRIORITY_ORDER] ?? 0;
  return eventOrder >= minOrder;
}

// ---------------------------------------------------------------------------
// Notification Routing Helpers
// ---------------------------------------------------------------------------

/**
 * Check if a messaging connection passes its routing rules for this event.
 * Returns true if no routing rules are set (backward compatible).
 *
 * Rules use AND logic: if multiple rule fields are set, ALL must match.
 * Within a single field, values use OR logic (match any one).
 */
function passesRoutingRules(
  rules: RoutingRules | null | undefined,
  event: NotificationEvent,
): boolean {
  if (!rules) return true;

  const hasSources = rules.sources && rules.sources.length > 0;
  const hasActionTypes = rules.action_types && rules.action_types.length > 0;
  const hasPriorities = rules.priorities && rules.priorities.length > 0;

  // Empty routing rules = receive everything
  if (!hasSources && !hasActionTypes && !hasPriorities) return true;

  // Sources filter: approval source must match one of the configured sources
  if (hasSources) {
    const eventSource = event.source ?? "";
    if (!rules.sources!.some((s) => s === eventSource)) {
      return false;
    }
  }

  // Action types filter: supports glob patterns (e.g. "deploy*")
  if (hasActionTypes) {
    const eventActionType = event.actionType ?? "";
    if (!rules.action_types!.some((pattern) => matchGlob(pattern, eventActionType))) {
      return false;
    }
  }

  // Priorities filter: approval priority must be in the list
  if (hasPriorities) {
    if (!rules.priorities!.includes(event.requestPriority)) {
      return false;
    }
  }

  return true;
}

/**
 * Simple glob matching that supports trailing wildcards (e.g. "deploy*").
 * For exact matches, just compares strings directly.
 */
function matchGlob(pattern: string, value: string): boolean {
  if (!pattern.includes("*")) {
    return pattern === value;
  }

  // Convert glob to regex: escape special regex chars, replace * with .*
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(value);
}

/**
 * Determine if a messaging connection represents a direct message / personal
 * channel (as opposed to a shared group/channel). DM connections should only
 * receive notifications relevant to their installer.
 *
 * Heuristic: Telegram chats with positive IDs are typically personal DMs.
 * Slack DMs use "D" prefix channel IDs. Discord DMs use specific patterns.
 * If channel_name is explicitly set and indicates a DM, treat it as such.
 */
function isDmChannel(conn: MessagingConnection): boolean {
  const name = conn.channel_name?.toLowerCase() ?? "";

  // Explicit DM markers in channel name
  if (name.startsWith("dm:") || name === "direct message") {
    return true;
  }

  // Slack: DM channels start with "D"
  if (conn.platform === "slack" && conn.channel_id.startsWith("D")) {
    return true;
  }

  // Telegram: positive chat IDs are personal DMs, negative are groups
  if (conn.platform === "telegram") {
    const chatId = parseInt(conn.channel_id, 10);
    if (!isNaN(chatId) && chatId > 0) {
      return true;
    }
  }

  return false;
}

/**
 * Check if a string looks like a UUID (v4).
 */
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Resolve a user ID to their display name (full_name or email).
 * Falls back to the original ID if the lookup fails.
 */
async function resolveUserName(userId: string): Promise<string> {
  try {
    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("user_profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single();

    if (profile) {
      return profile.full_name || profile.email || userId;
    }
  } catch (err) {
    logger.error("[Notifications] Failed to resolve user name:", err);
  }
  return userId;
}

/**
 * Load all user IDs that are members of a given team. This is called at most
 * once per notification dispatch (lazy-loaded and cached for the loop).
 */
async function loadTeamMemberIds(teamId: string): Promise<Set<string>> {
  try {
    const admin = createAdminClient();
    const { data: memberships, error } = await admin
      .from("team_memberships")
      .select("user_id")
      .eq("team_id", teamId);

    if (error || !memberships) {
      logger.error("[Notifications] Failed to load team memberships:", error);
      return new Set();
    }

    return new Set(memberships.map((m) => m.user_id));
  } catch (err) {
    logger.error("[Notifications] Team membership lookup error:", err);
    return new Set();
  }
}

/**
 * Load phone numbers for a set of users. Returns a map of userId to phone.
 * Only includes users who have a phone number set.
 */
async function loadUserPhoneNumbers(
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("user_profiles")
      .select("id, phone_number")
      .in("id", userIds)
      .not("phone_number", "is", null);

    if (error || !data) {
      logger.error("[Notifications] Failed to load phone numbers:", error);
      return new Map();
    }

    const map = new Map<string, string>();
    for (const row of data) {
      if (row.phone_number) {
        map.set(row.id, row.phone_number);
      }
    }
    return map;
  } catch (err) {
    logger.error("[Notifications] Phone number lookup error:", err);
    return new Map();
  }
}

/**
 * Build an SMS body for a notification event.
 */
function buildSmsBody(event: NotificationEvent): string {
  switch (event.type) {
    case "approval.created":
    case "approval.next_approver":
      return `OKRunit: "${event.requestTitle}" needs your approval. Reply APPROVE or REJECT.`;
    case "approval.approved":
      return `OKRunit: "${event.requestTitle}" was approved${event.decidedBy ? ` by ${event.decidedBy}` : ""}.`;
    case "approval.rejected":
      return `OKRunit: "${event.requestTitle}" was rejected${event.decidedBy ? ` by ${event.decidedBy}` : ""}.`;
    case "approval.cancelled":
      return `OKRunit: "${event.requestTitle}" was cancelled.`;
    case "approval.expired":
      return `OKRunit: "${event.requestTitle}" has expired.`;
    case "approval.sla_warning":
      return `OKRunit: "${event.requestTitle}" is approaching its SLA deadline. Act soon.`;
    case "approval.sla_breached":
      return `OKRunit: "${event.requestTitle}" has breached its SLA deadline.`;
    case "approval.escalated":
      return `OKRunit: "${event.requestTitle}" has been escalated and requires immediate attention.`;
    default:
      return `OKRunit: "${event.requestTitle}" has been updated.`;
  }
}

/**
 * Map notification event types to webhook event names for filtering.
 */
function mapEventToWebhookEvent(type: NotificationEventType): string {
  const map: Record<NotificationEventType, string> = {
    "approval.created": "request.created",
    "approval.approved": "request.approved",
    "approval.rejected": "request.rejected",
    "approval.cancelled": "request.cancelled",
    "approval.expired": "request.expired",
    "approval.comment": "request.comment",
    "approval.next_approver": "request.created",
    "approval.execution_cancelled": "request.cancelled",
    "approval.sla_warning": "request.sla_warning",
    "approval.sla_breached": "request.sla_breached",
    "approval.bottleneck": "request.bottleneck",
    "approval.escalated": "request.escalated",
  };
  return map[type] ?? "request.updated";
}
