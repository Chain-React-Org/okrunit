/**
 * OKRunit Approval Component for Retool Custom Components
 *
 * Embed this React component in a Retool custom component to display
 * approval status and provide approve/reject controls inline.
 */

import React, { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ApprovalData {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  source: string;
  decided_by_name?: string;
  decided_at?: string;
  decision_comment?: string;
  created_at: string;
  updated_at: string;
  required_approvals?: number;
  current_approvals?: number;
  requested_by_name?: string;
}

interface ApprovalStep {
  id: string;
  status: string;
  decided_by_name?: string;
  decision_comment?: string;
  decided_at?: string;
}

export interface OKRunitApprovalProps {
  /** OKRunit API key (starts with gk_) */
  apiKey: string;
  /** OKRunit instance URL */
  apiUrl?: string;
  /** Approval request ID to display */
  approvalId: string;
  /** Whether the current user can approve/reject */
  canDecide?: boolean;
  /** Auto-refresh interval in seconds (0 to disable, default: 15) */
  refreshInterval?: number;
  /** Callback when approval status changes */
  onStatusChange?: (status: string) => void;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "16px",
    backgroundColor: "#ffffff",
    maxWidth: "480px",
  } as React.CSSProperties,
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px",
  } as React.CSSProperties,
  title: {
    fontSize: "16px",
    fontWeight: 600,
    color: "#1a202c",
    margin: 0,
  } as React.CSSProperties,
  badge: (color: string, bg: string) =>
    ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: 500,
      color,
      backgroundColor: bg,
    }) as React.CSSProperties,
  description: {
    fontSize: "14px",
    color: "#4a5568",
    marginBottom: "12px",
    lineHeight: 1.5,
  } as React.CSSProperties,
  meta: {
    fontSize: "12px",
    color: "#718096",
    marginBottom: "4px",
  } as React.CSSProperties,
  metaSection: {
    marginBottom: "12px",
  } as React.CSSProperties,
  actions: {
    display: "flex",
    gap: "8px",
    marginTop: "16px",
  } as React.CSSProperties,
  button: (variant: "approve" | "reject") =>
    ({
      flex: 1,
      padding: "8px 16px",
      borderRadius: "6px",
      border: "none",
      fontSize: "14px",
      fontWeight: 500,
      cursor: "pointer",
      color: "#ffffff",
      backgroundColor: variant === "approve" ? "#38a169" : "#e53e3e",
      opacity: 1,
    }) as React.CSSProperties,
  buttonDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  } as React.CSSProperties,
  commentInput: {
    width: "100%",
    padding: "8px",
    borderRadius: "6px",
    border: "1px solid #e2e8f0",
    fontSize: "14px",
    marginTop: "8px",
    boxSizing: "border-box",
    resize: "vertical",
  } as React.CSSProperties,
  error: {
    color: "#e53e3e",
    fontSize: "13px",
    marginTop: "8px",
  } as React.CSSProperties,
  loading: {
    textAlign: "center",
    padding: "24px",
    color: "#718096",
    fontSize: "14px",
  } as React.CSSProperties,
  decisionInfo: {
    marginTop: "12px",
    padding: "10px",
    borderRadius: "6px",
    backgroundColor: "#f7fafc",
    fontSize: "13px",
    color: "#4a5568",
  } as React.CSSProperties,
};

const STATUS_BADGES: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: "#b7791f", bg: "#fefcbf", label: "Pending" },
  approved: { color: "#276749", bg: "#c6f6d5", label: "Approved" },
  rejected: { color: "#9b2c2c", bg: "#fed7d7", label: "Rejected" },
  cancelled: { color: "#4a5568", bg: "#e2e8f0", label: "Cancelled" },
  expired: { color: "#744210", bg: "#feebc8", label: "Expired" },
};

const PRIORITY_BADGES: Record<string, { color: string; bg: string }> = {
  low: { color: "#4a5568", bg: "#edf2f7" },
  medium: { color: "#2b6cb0", bg: "#bee3f8" },
  high: { color: "#c05621", bg: "#feebc8" },
  critical: { color: "#9b2c2c", bg: "#fed7d7" },
};

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchApproval(
  apiUrl: string,
  apiKey: string,
  approvalId: string,
): Promise<ApprovalData> {
  const resp = await fetch(`${apiUrl}/api/v1/approvals/${approvalId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OKRunit API error (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<ApprovalData>;
}

async function submitDecision(
  apiUrl: string,
  apiKey: string,
  approvalId: string,
  decision: "approved" | "rejected",
  comment?: string,
): Promise<ApprovalStep> {
  const resp = await fetch(`${apiUrl}/api/v1/approvals/${approvalId}/steps`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      decision,
      ...(comment ? { comment } : {}),
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OKRunit API error (${resp.status}): ${text}`);
  }

  return resp.json() as Promise<ApprovalStep>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * OKRunit Approval Component
 *
 * Displays an approval request with status, details, and optional
 * approve/reject controls. Designed for embedding in Retool custom components.
 *
 * @example
 * ```tsx
 * <OKRunitApproval
 *   apiKey={OKRUNIT_API_KEY}
 *   approvalId="550e8400-e29b-41d4-a716-446655440000"
 *   canDecide={true}
 *   onStatusChange={(status) => console.log("New status:", status)}
 * />
 * ```
 */
export function OKRunitApproval({
  apiKey,
  apiUrl = "https://app.okrunit.com",
  approvalId,
  canDecide = false,
  refreshInterval = 15,
  onStatusChange,
}: OKRunitApprovalProps) {
  const [approval, setApproval] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [lastStatus, setLastStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchApproval(apiUrl, apiKey, approvalId);
      setApproval(data);
      setError(null);

      if (data.status !== lastStatus) {
        setLastStatus(data.status);
        onStatusChange?.(data.status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load approval");
    } finally {
      setLoading(false);
    }
  }, [apiUrl, apiKey, approvalId, lastStatus, onStatusChange]);

  useEffect(() => {
    load();

    if (refreshInterval > 0) {
      const interval = setInterval(load, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [load, refreshInterval]);

  const handleDecision = useCallback(
    async (decision: "approved" | "rejected") => {
      setSubmitting(true);
      setError(null);

      try {
        await submitDecision(apiUrl, apiKey, approvalId, decision, comment || undefined);
        setComment("");
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit decision");
      } finally {
        setSubmitting(false);
      }
    },
    [apiUrl, apiKey, approvalId, comment, load],
  );

  if (loading && !approval) {
    return <div style={styles.loading as React.CSSProperties}>Loading approval...</div>;
  }

  if (!approval) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error ?? "Approval not found"}</div>
      </div>
    );
  }

  const statusInfo = STATUS_BADGES[approval.status] ?? STATUS_BADGES.pending;
  const priorityInfo = PRIORITY_BADGES[approval.priority] ?? PRIORITY_BADGES.medium;
  const isPending = approval.status === "pending";
  const showActions = canDecide && isPending;

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h3 style={styles.title}>{approval.title}</h3>
        <span style={styles.badge(statusInfo.color, statusInfo.bg)}>
          {statusInfo.label}
        </span>
      </div>

      {/* Description */}
      {approval.description && (
        <div style={styles.description}>{approval.description}</div>
      )}

      {/* Metadata */}
      <div style={styles.metaSection}>
        <div style={styles.meta}>
          <strong>Priority:</strong>{" "}
          <span style={styles.badge(priorityInfo.color, priorityInfo.bg)}>
            {approval.priority}
          </span>
        </div>
        {approval.requested_by_name && (
          <div style={styles.meta}>
            <strong>Requested by:</strong> {approval.requested_by_name}
          </div>
        )}
        <div style={styles.meta}>
          <strong>Created:</strong>{" "}
          {new Date(approval.created_at).toLocaleString()}
        </div>
        {approval.required_approvals != null &&
          approval.required_approvals > 1 && (
            <div style={styles.meta}>
              <strong>Approvals:</strong> {approval.current_approvals ?? 0} /{" "}
              {approval.required_approvals}
            </div>
          )}
      </div>

      {/* Decision info (if already decided) */}
      {!isPending && approval.decided_by_name && (
        <div style={styles.decisionInfo}>
          <div>
            <strong>
              {approval.status === "approved" ? "Approved" : "Rejected"} by:
            </strong>{" "}
            {approval.decided_by_name}
          </div>
          {approval.decided_at && (
            <div>
              <strong>At:</strong>{" "}
              {new Date(approval.decided_at).toLocaleString()}
            </div>
          )}
          {approval.decision_comment && (
            <div>
              <strong>Comment:</strong> {approval.decision_comment}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {showActions && (
        <>
          <textarea
            style={styles.commentInput as React.CSSProperties}
            placeholder="Optional comment..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
          />
          <div style={styles.actions}>
            <button
              style={{
                ...styles.button("approve"),
                ...(submitting ? styles.buttonDisabled : {}),
              }}
              disabled={submitting}
              onClick={() => handleDecision("approved")}
            >
              {submitting ? "..." : "Approve"}
            </button>
            <button
              style={{
                ...styles.button("reject"),
                ...(submitting ? styles.buttonDisabled : {}),
              }}
              disabled={submitting}
              onClick={() => handleDecision("rejected")}
            >
              {submitting ? "..." : "Reject"}
            </button>
          </div>
        </>
      )}

      {/* Error */}
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
}

export default OKRunitApproval;
