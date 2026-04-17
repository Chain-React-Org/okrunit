// ---------------------------------------------------------------------------
// OKrunit -- Tests for Notification Delivery Log
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Supabase admin client mock -------------------------------------------

const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

import {
  logNotificationDelivery,
  logNotificationDeliveryBatch,
  type DeliveryLogEntry,
} from "../delivery-log";

// ---- Setup ------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockInsert.mockResolvedValue({ data: null, error: null });
});

// ---- logNotificationDelivery ------------------------------------------------

describe("logNotificationDelivery", () => {
  it("inserts correct fields for a minimal entry", async () => {
    await logNotificationDelivery({
      orgId: "org-1",
      channel: "email",
      status: "sent",
    });

    expect(mockFrom).toHaveBeenCalledWith("notification_delivery_log");
    expect(mockInsert).toHaveBeenCalledWith({
      org_id: "org-1",
      request_id: null,
      recipient_user_id: null,
      channel: "email",
      status: "sent",
      suppression_reason: null,
      error_message: null,
      external_id: null,
      metadata: {},
    });
  });

  it("inserts correct fields for a fully populated entry", async () => {
    await logNotificationDelivery({
      orgId: "org-1",
      requestId: "req-abc",
      recipientUserId: "user-123",
      channel: "slack",
      status: "sent",
      suppressionReason: undefined,
      errorMessage: undefined,
      externalId: "slack-msg-456",
      metadata: { thread_ts: "1234567890.123456" },
    });

    expect(mockInsert).toHaveBeenCalledWith({
      org_id: "org-1",
      request_id: "req-abc",
      recipient_user_id: "user-123",
      channel: "slack",
      status: "sent",
      suppression_reason: null,
      error_message: null,
      external_id: "slack-msg-456",
      metadata: { thread_ts: "1234567890.123456" },
    });
  });

  it("maps suppressionReason correctly for suppressed notifications", async () => {
    await logNotificationDelivery({
      orgId: "org-1",
      channel: "email",
      status: "suppressed",
      suppressionReason: "User has disabled email notifications",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "suppressed",
        suppression_reason: "User has disabled email notifications",
      }),
    );
  });

  it("maps errorMessage correctly for failed notifications", async () => {
    await logNotificationDelivery({
      orgId: "org-1",
      channel: "discord",
      status: "failed",
      errorMessage: "Webhook URL returned 403",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        error_message: "Webhook URL returned 403",
      }),
    );
  });

  it("does not throw when insert fails (fire-and-forget)", async () => {
    mockInsert.mockRejectedValue(new Error("Database connection lost"));

    // Should not throw
    await expect(
      logNotificationDelivery({
        orgId: "org-1",
        channel: "email",
        status: "sent",
      }),
    ).resolves.toBeUndefined();
  });

  it("logs error when insert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsert.mockRejectedValue(new Error("Connection timeout"));

    await logNotificationDelivery({
      orgId: "org-1",
      channel: "email",
      status: "sent",
    });

    // logger.error outputs JSON via console.error
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("accepts all valid channel types", async () => {
    const channels: DeliveryLogEntry["channel"][] = [
      "email",
      "slack",
      "discord",
      "teams",
      "telegram",
      "web_push",
      "webhook",
      "sms",
    ];

    for (const channel of channels) {
      vi.clearAllMocks();
      await logNotificationDelivery({
        orgId: "org-1",
        channel,
        status: "sent",
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ channel }),
      );
    }
  });

  it("accepts all valid status values", async () => {
    const statuses: DeliveryLogEntry["status"][] = [
      "sent",
      "failed",
      "suppressed",
    ];

    for (const status of statuses) {
      vi.clearAllMocks();
      await logNotificationDelivery({
        orgId: "org-1",
        channel: "email",
        status,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ status }),
      );
    }
  });
});

// ---- logNotificationDeliveryBatch -------------------------------------------

describe("logNotificationDeliveryBatch", () => {
  it("handles empty arrays by returning early without DB call", async () => {
    await logNotificationDeliveryBatch([]);

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts multiple entries in a single batch", async () => {
    const entries: DeliveryLogEntry[] = [
      { orgId: "org-1", channel: "email", status: "sent", recipientUserId: "user-1" },
      { orgId: "org-1", channel: "slack", status: "sent", recipientUserId: "user-2" },
      { orgId: "org-1", channel: "email", status: "suppressed", recipientUserId: "user-3", suppressionReason: "Opted out" },
    ];

    await logNotificationDeliveryBatch(entries);

    expect(mockFrom).toHaveBeenCalledWith("notification_delivery_log");
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertedRows = mockInsert.mock.calls[0][0];
    expect(insertedRows).toHaveLength(3);
    expect(insertedRows[0].channel).toBe("email");
    expect(insertedRows[0].recipient_user_id).toBe("user-1");
    expect(insertedRows[1].channel).toBe("slack");
    expect(insertedRows[2].suppression_reason).toBe("Opted out");
  });

  it("maps all optional fields to null when not provided", async () => {
    await logNotificationDeliveryBatch([
      { orgId: "org-1", channel: "email", status: "sent" },
    ]);

    const insertedRows = mockInsert.mock.calls[0][0];
    expect(insertedRows[0]).toEqual({
      org_id: "org-1",
      request_id: null,
      recipient_user_id: null,
      channel: "email",
      status: "sent",
      suppression_reason: null,
      error_message: null,
      external_id: null,
      metadata: {},
    });
  });

  it("does not throw when batch insert fails (fire-and-forget)", async () => {
    mockInsert.mockRejectedValue(new Error("Batch insert failed"));

    await expect(
      logNotificationDeliveryBatch([
        { orgId: "org-1", channel: "email", status: "sent" },
      ]),
    ).resolves.toBeUndefined();
  });

  it("logs error when batch insert fails", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockInsert.mockRejectedValue(new Error("Batch failed"));

    await logNotificationDeliveryBatch([
      { orgId: "org-1", channel: "email", status: "sent" },
    ]);

    // logger.error outputs JSON via console.error
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it("correctly maps metadata for batch entries", async () => {
    await logNotificationDeliveryBatch([
      {
        orgId: "org-1",
        channel: "slack",
        status: "sent",
        metadata: { thread_ts: "123", channel_id: "C01ABC" },
      },
      {
        orgId: "org-1",
        channel: "email",
        status: "sent",
        metadata: { template: "approval_created" },
      },
    ]);

    const insertedRows = mockInsert.mock.calls[0][0];
    expect(insertedRows[0].metadata).toEqual({
      thread_ts: "123",
      channel_id: "C01ABC",
    });
    expect(insertedRows[1].metadata).toEqual({
      template: "approval_created",
    });
  });
});
