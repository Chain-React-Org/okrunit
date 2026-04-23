// ---------------------------------------------------------------------------
// OKrunit -- Notification Event Types
// ---------------------------------------------------------------------------

/**
 * All notification-worthy events in the approval lifecycle.
 */
export type NotificationEventType =
  | "approval.created"
  | "approval.approved"
  | "approval.rejected"
  | "approval.cancelled"
  | "approval.expired"
  | "approval.comment"
  | "approval.next_approver"
  | "approval.execution_cancelled"
  | "approval.sla_warning"
  | "approval.sla_breached"
  | "approval.bottleneck"
  | "approval.escalated";

/**
 * Payload passed into the notification orchestrator whenever an event occurs.
 * Contains everything the channel adapters need to build their messages.
 */
export interface NotificationEvent {
  /** The lifecycle event that triggered the notification. */
  type: NotificationEventType;
  /** Organisation that owns the approval request. */
  orgId: string;
  /** The approval request this event relates to. */
  requestId: string;
  /** Human-readable title of the approval request. */
  requestTitle: string;
  /** Optional longer description of what is being requested. */
  requestDescription?: string;
  /** Priority level of the request (low | medium | high | critical). */
  requestPriority: string;
  /** The connection (integration) that created the request, if applicable. */
  connectionId?: string;
  /** Human-readable name of the connection, if available. */
  connectionName?: string;
  /** User ID of whoever made the decision (approve / reject / cancel). */
  decidedBy?: string;
  /** Optional comment left with the decision. */
  decisionComment?: string;
  /** When set, only notify these specific users instead of all org members. */
  targetUserIds?: string[];
  /** When set, only send messaging notifications to these specific connection IDs. */
  notifyChannelIds?: string[];
  /** The source platform that created this approval (e.g. "api", "zapier"). */
  source?: string;
  /** The action type of the approval request (e.g. "deploy", "delete"). */
  actionType?: string;
  /** Assigned approver user IDs, used for DM-level filtering. */
  assignedApprovers?: string[];
  /** Assigned team ID, used for DM-level filtering. */
  assignedTeamId?: string;
  /** Whether the flow is sequential. When true, only currentTurnUserId can
   * decide right now; other assigned approvers should see an FYI without
   * action buttons. */
  isSequential?: boolean;
  /** For sequential flows, the user whose turn it currently is. */
  currentTurnUserId?: string;
  /** Current escalation level (1, 2, 3...) for escalated events. */
  escalationLevel?: number;
}
