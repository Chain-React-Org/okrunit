// ---------------------------------------------------------------------------
// OKrunit -- Tests for Webhook Retry Logic
// ---------------------------------------------------------------------------

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the Supabase admin client (needed by deliverCallback but not by our tests)
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

// Mock the SSRF check
vi.mock("../ssrf", () => ({
  resolveAndCheckUrl: vi.fn().mockResolvedValue(false),
}));

import {
  WEBHOOK_RETRY_DELAYS_MS,
  WEBHOOK_MAX_ATTEMPTS,
  attemptWebhookDelivery,
} from "../callbacks";

// ---- Retry delay constants --------------------------------------------------

describe("WEBHOOK_RETRY_DELAYS_MS", () => {
  it("contains exactly 7 delay entries", () => {
    expect(WEBHOOK_RETRY_DELAYS_MS).toHaveLength(7);
  });

  it("starts with 1 minute (60,000ms)", () => {
    expect(WEBHOOK_RETRY_DELAYS_MS[0]).toBe(60_000);
  });

  it("has 5 minutes (300,000ms) as second delay", () => {
    expect(WEBHOOK_RETRY_DELAYS_MS[1]).toBe(300_000);
  });

  it("has 30 minutes (1,800,000ms) as third delay", () => {
    expect(WEBHOOK_RETRY_DELAYS_MS[2]).toBe(1_800_000);
  });

  it("has 2 hours (7,200,000ms) as fourth delay", () => {
    expect(WEBHOOK_RETRY_DELAYS_MS[3]).toBe(7_200_000);
  });

  it("has 12 hours (43,200,000ms) as fifth delay", () => {
    expect(WEBHOOK_RETRY_DELAYS_MS[4]).toBe(43_200_000);
  });

  it("has 24 hours (86,400,000ms) as sixth delay", () => {
    expect(WEBHOOK_RETRY_DELAYS_MS[5]).toBe(86_400_000);
  });

  it("has 48 hours (172,800,000ms) as seventh delay", () => {
    expect(WEBHOOK_RETRY_DELAYS_MS[6]).toBe(172_800_000);
  });

  it("delays are in ascending order (exponential backoff)", () => {
    for (let i = 1; i < WEBHOOK_RETRY_DELAYS_MS.length; i++) {
      expect(WEBHOOK_RETRY_DELAYS_MS[i]).toBeGreaterThan(
        WEBHOOK_RETRY_DELAYS_MS[i - 1],
      );
    }
  });
});

// ---- WEBHOOK_MAX_ATTEMPTS ---------------------------------------------------

describe("WEBHOOK_MAX_ATTEMPTS", () => {
  it("equals retry delays length + 1 (for the initial inline attempt)", () => {
    expect(WEBHOOK_MAX_ATTEMPTS).toBe(WEBHOOK_RETRY_DELAYS_MS.length + 1);
  });

  it("is 8 total attempts", () => {
    expect(WEBHOOK_MAX_ATTEMPTS).toBe(8);
  });
});

// ---- attemptWebhookDelivery -------------------------------------------------

describe("attemptWebhookDelivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    // Clear HMAC secret so we can test without it
    delete process.env.CALLBACK_HMAC_SECRET;
  });

  it("returns success=true for a 200 response", async () => {
    const mockResponse = {
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      text: vi.fn().mockResolvedValue('{"ok":true}'),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    const result = await attemptWebhookDelivery(
      "https://example.com/webhook",
      { event: "approved", id: "req-1" },
    );

    expect(result.success).toBe(true);
    expect(result.responseStatus).toBe(200);
    expect(result.errorMessage).toBeNull();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns success=true for any 2xx response", async () => {
    const mockResponse = {
      status: 204,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(""),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    const result = await attemptWebhookDelivery(
      "https://example.com/webhook",
      { event: "approved" },
    );

    expect(result.success).toBe(true);
    expect(result.responseStatus).toBe(204);
  });

  it("returns success=false for a 500 response", async () => {
    const mockResponse = {
      status: 500,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue("Internal Server Error"),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    const result = await attemptWebhookDelivery(
      "https://example.com/webhook",
      { event: "approved" },
    );

    expect(result.success).toBe(false);
    expect(result.responseStatus).toBe(500);
    expect(result.errorMessage).toContain("Non-2xx");
  });

  it("returns success=false for a 404 response", async () => {
    const mockResponse = {
      status: 404,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue("Not Found"),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    const result = await attemptWebhookDelivery(
      "https://example.com/webhook",
      { event: "approved" },
    );

    expect(result.success).toBe(false);
    expect(result.responseStatus).toBe(404);
  });

  it("returns success=false when fetch throws a network error", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Network connection refused"),
    );

    const result = await attemptWebhookDelivery(
      "https://example.com/webhook",
      { event: "approved" },
    );

    expect(result.success).toBe(false);
    expect(result.responseStatus).toBeNull();
    expect(result.errorMessage).toContain("Network connection refused");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("sends POST with correct Content-Type header", async () => {
    const mockResponse = {
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue("ok"),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    await attemptWebhookDelivery("https://example.com/webhook", {
      event: "test",
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ event: "test" }),
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("merges custom callback headers into the request", async () => {
    const mockResponse = {
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue("ok"),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    await attemptWebhookDelivery(
      "https://example.com/webhook",
      { event: "test" },
      { Authorization: "Bearer my-token", "X-Custom": "value" },
    );

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://example.com/webhook",
      expect.objectContaining({
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer my-token",
          "X-Custom": "value",
        }),
      }),
    );
  });

  it("includes HMAC signature headers when CALLBACK_HMAC_SECRET is set", async () => {
    process.env.CALLBACK_HMAC_SECRET = "test-secret-key";

    const mockResponse = {
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue("ok"),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    await attemptWebhookDelivery("https://example.com/webhook", {
      event: "test",
    });

    const callArgs = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0][1];
    expect(callArgs.headers["X-OKrunit-Signature"]).toMatch(/^sha256=/);
    expect(callArgs.headers["X-OKrunit-Timestamp"]).toBeDefined();

    delete process.env.CALLBACK_HMAC_SECRET;
  });

  it("captures response headers in the result", async () => {
    const responseHeaders = new Headers({
      "x-request-id": "req-abc-123",
      "content-type": "application/json",
    });
    const mockResponse = {
      status: 200,
      headers: responseHeaders,
      text: vi.fn().mockResolvedValue('{"received":true}'),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    const result = await attemptWebhookDelivery(
      "https://example.com/webhook",
      { event: "test" },
    );

    expect(result.responseHeaders).toBeDefined();
    expect(result.responseHeaders!["x-request-id"]).toBe("req-abc-123");
  });

  it("truncates response body to 10,000 characters", async () => {
    const longBody = "x".repeat(15_000);
    const mockResponse = {
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(longBody),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    const result = await attemptWebhookDelivery(
      "https://example.com/webhook",
      { event: "test" },
    );

    expect(result.responseBody!.length).toBe(10_000);
  });

  it("returns a well-structured DeliveryAttemptResult on all paths", async () => {
    const mockResponse = {
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue("ok"),
    };
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockResponse,
    );

    const result = await attemptWebhookDelivery(
      "https://example.com/webhook",
      { event: "test" },
    );

    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("responseStatus");
    expect(result).toHaveProperty("responseHeaders");
    expect(result).toHaveProperty("responseBody");
    expect(result).toHaveProperty("durationMs");
    expect(result).toHaveProperty("errorMessage");
  });
});

// ---- Backoff delay calculation verification --------------------------------

describe("backoff delay schedule", () => {
  it("total retry window spans approximately 3.6 days", () => {
    const totalMs = WEBHOOK_RETRY_DELAYS_MS.reduce(
      (sum, delay) => sum + delay,
      0,
    );
    const totalHours = totalMs / (1000 * 60 * 60);

    // Sum: 1min + 5min + 30min + 2hr + 12hr + 24hr + 48hr = ~86.6 hours
    expect(totalHours).toBeCloseTo(86.6, 0);
  });

  it("each delay is at least 2x the previous (exponential growth)", () => {
    for (let i = 1; i < WEBHOOK_RETRY_DELAYS_MS.length; i++) {
      const ratio =
        WEBHOOK_RETRY_DELAYS_MS[i] / WEBHOOK_RETRY_DELAYS_MS[i - 1];
      // Each step should be at least 2x the previous (some are more)
      expect(ratio).toBeGreaterThanOrEqual(2);
    }
  });
});
