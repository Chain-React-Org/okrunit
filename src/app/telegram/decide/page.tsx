"use client";

import { useState, useEffect } from "react";

// ---------------------------------------------------------------------------
// Telegram Mini App — Decision Form
// ---------------------------------------------------------------------------
//
// Opened as a Telegram Web App popup when a user clicks Approve or Reject
// on an approval notification. Shows the request title, a reason text area,
// and confirm/cancel buttons.
//
// URL format: /telegram/decide?id=<requestId>&action=<approve|reject>
//
// On submit, POSTs to /api/telegram/decide with the decision + comment,
// then calls Telegram.WebApp.close() to dismiss the popup.
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        ready: () => void;
        close: () => void;
        initData: string;
        initDataUnsafe: {
          user?: { id: number; first_name: string; last_name?: string; username?: string };
          query_id?: string;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        colorScheme: "light" | "dark";
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          setText: (text: string) => void;
          setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
        };
      };
    };
  }
}

interface RequestInfo {
  id: string;
  title: string;
  description?: string;
  priority: string;
  status: string;
  reasonRequired: boolean;
}

export default function TelegramDecidePage() {
  const [requestId, setRequestId] = useState<string | null>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);
  const [request, setRequest] = useState<RequestInfo | null>(null);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  // Parse URL params and init Telegram WebApp
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    const act = params.get("action") as "approve" | "reject" | null;
    setRequestId(id);
    setAction(act);

    // Tell Telegram the Mini App is ready
    window.Telegram?.WebApp?.ready();
  }, []);

  // Fetch request info
  useEffect(() => {
    if (!requestId) return;

    async function fetchRequest() {
      try {
        const initData = window.Telegram?.WebApp?.initData || "";
        const res = await fetch(`/api/telegram/decide?id=${requestId}`, {
          headers: { "X-Telegram-Init-Data": initData },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(data?.error || "Request not found");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setRequest(data);
      } catch {
        setError("Failed to load request");
      } finally {
        setLoading(false);
      }
    }

    fetchRequest();
  }, [requestId]);

  async function handleSubmit() {
    if (!requestId || !action || submitting) return;
    if (request?.reasonRequired && action === "reject" && !comment.trim()) return;

    setSubmitting(true);
    try {
      const initData = window.Telegram?.WebApp?.initData || "";
      const res = await fetch("/api/telegram/decide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Telegram-Init-Data": initData,
        },
        body: JSON.stringify({
          requestId,
          action,
          comment: comment.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || "Failed to submit decision");
        setSubmitting(false);
        return;
      }

      setDone(true);
      // Close the Mini App after a brief pause so the user sees success
      setTimeout(() => {
        window.Telegram?.WebApp?.close();
      }, 1000);
    } catch {
      setError("Failed to submit decision");
      setSubmitting(false);
    }
  }

  // Telegram theme colors (guard for SSR where window is undefined)
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  const isDark = tg?.colorScheme === "dark";
  const bgColor = tg?.themeParams?.bg_color || (isDark ? "#1c1c1e" : "#ffffff");
  const textColor = tg?.themeParams?.text_color || (isDark ? "#ffffff" : "#000000");
  const hintColor = tg?.themeParams?.hint_color || (isDark ? "#98989e" : "#999999");
  const secondaryBg = tg?.themeParams?.secondary_bg_color || (isDark ? "#2c2c2e" : "#f2f2f7");
  const isApprove = action === "approve";
  const actionColor = isApprove ? "#34c759" : "#ff3b30";

  if (loading) {
    return (
      <div style={{ background: bgColor, color: textColor, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
        <p style={{ color: hintColor }}>Loading...</p>
      </div>
    );
  }

  if (done) {
    return (
      <div style={{ background: bgColor, color: textColor, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", gap: 8 }}>
        <div style={{ fontSize: 48 }}>{isApprove ? "\u2705" : "\u274c"}</div>
        <p style={{ fontSize: 17, fontWeight: 600 }}>{isApprove ? "Approved" : "Rejected"}</p>
      </div>
    );
  }

  if (error || !request || !action) {
    return (
      <div style={{ background: bgColor, color: textColor, minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: 24, textAlign: "center", gap: 12 }}>
        <p style={{ fontSize: 17, fontWeight: 600 }}>{error || "Invalid request"}</p>
        <button
          onClick={() => window.Telegram?.WebApp?.close()}
          style={{ background: secondaryBg, color: textColor, border: "none", borderRadius: 10, padding: "10px 24px", fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          Close
        </button>
      </div>
    );
  }

  const reasonRequired = request.reasonRequired && action === "reject";
  const canSubmit = !reasonRequired || comment.trim().length > 0;

  return (
    <div style={{ background: bgColor, color: textColor, minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", padding: "20px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 20 }}>{isApprove ? "\u2705" : "\u274c"}</span>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
            {isApprove ? "Approve" : "Reject"} Request
          </h1>
        </div>
      </div>

      {/* Request info card */}
      <div style={{ background: secondaryBg, borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px 0" }}>{request.title}</p>
        {request.description && (
          <p style={{ fontSize: 13, color: hintColor, margin: "0 0 8px 0" }}>{request.description}</p>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "2px 8px",
            borderRadius: 6,
            background: request.priority === "critical" || request.priority === "high" ? "#ff3b3020" : isDark ? "#3a3a3c" : "#e5e5ea",
            color: request.priority === "critical" || request.priority === "high" ? "#ff3b30" : hintColor,
          }}>
            {request.priority.charAt(0).toUpperCase() + request.priority.slice(1)}
          </span>
        </div>
      </div>

      {/* Reason input */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: hintColor, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
          {reasonRequired ? "Reason (required)" : "Reason (optional)"}
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={isApprove ? "Add a comment..." : "Why is this request being rejected?"}
          rows={3}
          autoFocus
          style={{
            width: "100%",
            background: secondaryBg,
            color: textColor,
            border: "none",
            borderRadius: 10,
            padding: 12,
            fontSize: 15,
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10 }}>
        <button
          onClick={() => window.Telegram?.WebApp?.close()}
          disabled={submitting}
          style={{
            flex: 1,
            background: secondaryBg,
            color: textColor,
            border: "none",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting ? "default" : "pointer",
            opacity: submitting ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            flex: 2,
            background: !canSubmit || submitting ? `${actionColor}80` : actionColor,
            color: "#ffffff",
            border: "none",
            borderRadius: 10,
            padding: "12px 16px",
            fontSize: 15,
            fontWeight: 600,
            cursor: !canSubmit || submitting ? "default" : "pointer",
          }}
        >
          {submitting ? "Submitting..." : isApprove ? "Approve" : "Reject"}
        </button>
      </div>
    </div>
  );
}
