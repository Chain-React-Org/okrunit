import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BillingDashboard } from "@/components/billing/billing-dashboard";
import type { Plan, Subscription, Invoice, BillingPlan } from "@/lib/types/database";

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

// Mock next/navigation (used transitively by some components)
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/billing",
}));

function makePlans(): Plan[] {
  const base = { description: null, stripe_price_id_monthly: null, stripe_price_id_yearly: null, is_active: true, created_at: "", updated_at: "" };
  return [
    { ...base, id: "free" as BillingPlan, name: "Free", price_monthly_cents: 0, price_yearly_cents: 0, max_requests_per_month: 100, max_connections: 2, max_team_members: 3, history_retention_days: 7, features: ["email_notifications"], sort_order: 0 },
    { ...base, id: "pro" as BillingPlan, name: "Pro", price_monthly_cents: 2000, price_yearly_cents: 19200, max_requests_per_month: -1, max_connections: 15, max_team_members: 15, history_retention_days: 90, features: ["email_notifications", "slack_notifications"], sort_order: 1 },
    { ...base, id: "business" as BillingPlan, name: "Business", price_monthly_cents: 6000, price_yearly_cents: 57600, max_requests_per_month: -1, max_connections: -1, max_team_members: -1, history_retention_days: 365, features: [], sort_order: 2 },
    { ...base, id: "enterprise" as BillingPlan, name: "Enterprise", price_monthly_cents: 0, price_yearly_cents: 0, max_requests_per_month: -1, max_connections: -1, max_team_members: -1, history_retention_days: -1, features: [], sort_order: 3 },
  ];
}

function makeSubscription(plan: BillingPlan = "free"): Subscription {
  return {
    id: "sub-1",
    org_id: "org-1",
    plan_id: plan,
    status: "active",
    billing_cycle: "monthly",
    stripe_customer_id: plan !== "free" ? "cus_123" : null,
    stripe_subscription_id: plan !== "free" ? "sub_123" : null,
    current_period_start: "2026-01-01",
    current_period_end: "2026-02-01",
    trial_end: null,
    cancelled_at: null,
    created_at: "2026-01-01",
    updated_at: "2026-01-01",
  };
}

const defaultUsage = {
  requests: 42,
  connections: 1,
  teamMembers: 2,
};

const defaultProps = {
  plans: makePlans(),
  subscription: makeSubscription("free"),
  usage: defaultUsage,
  invoices: [] as Invoice[],
  isAdmin: true,
  orgId: "org-1",
};

describe("BillingDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset fetch mock
    global.fetch = vi.fn();
  });

  describe("current plan display", () => {
    it("renders the current plan name", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Free")).toBeTruthy();
      expect(screen.getByText("Current Plan")).toBeTruthy();
    });

    it("renders Pro badge for pro plan", () => {
      render(
        <BillingDashboard
          {...defaultProps}
          subscription={makeSubscription("pro")}
        />,
      );
      expect(screen.getByText("Pro")).toBeTruthy();
    });
  });

  describe("usage bars", () => {
    it("displays request usage", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Requests this month")).toBeTruthy();
      expect(screen.getByText(/42/)).toBeTruthy();
    });

    it("displays connection usage", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Connections")).toBeTruthy();
    });

    it("displays team member usage", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Team members")).toBeTruthy();
    });

    it("shows unlimited label for pro plan requests", () => {
      render(
        <BillingDashboard
          {...defaultProps}
          subscription={makeSubscription("pro")}
        />,
      );
      expect(screen.getByText("(unlimited)")).toBeTruthy();
    });
  });

  describe("upgrade button", () => {
    it("shows upgrade CTA on free plan", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Upgrade to Pro")).toBeTruthy();
    });

    it("calls checkout API when upgrade button is clicked", async () => {
      const user = userEvent.setup();
      const mockFetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ url: "https://checkout.stripe.com/session" }),
      });
      global.fetch = mockFetch;

      // Mock window.location
      const locationSpy = vi.spyOn(window, "location", "get").mockReturnValue({
        ...window.location,
        href: "",
      });

      render(<BillingDashboard {...defaultProps} />);

      // Click "Upgrade — $20/mo" button (the CTA card button)
      const upgradeButton = screen.getByRole("button", { name: /Upgrade — \$20\/mo/ });
      await user.click(upgradeButton);

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("pro"),
      });

      locationSpy.mockRestore();
    });

    it("does not show upgrade CTA when already on pro plan", () => {
      render(
        <BillingDashboard
          {...defaultProps}
          subscription={makeSubscription("pro")}
        />,
      );
      // The quick-upgrade CTA card should not appear for pro users
      expect(screen.queryByText("Upgrade — $20/mo")).toBeNull();
    });
  });

  describe("plan comparison grid", () => {
    it("renders all 4 plans", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Plans")).toBeTruthy();
      // Each plan card shows the plan name
      expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
      // Pro appears as badge + plan card
      expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Business").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Enterprise").length).toBeGreaterThanOrEqual(1);
    });

    it("highlights current plan", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Your current plan")).toBeTruthy();
      expect(screen.getByText("Current plan")).toBeTruthy();
    });

    it("shows upgrade buttons only for higher plans", () => {
      render(<BillingDashboard {...defaultProps} />);
      // On free plan, should see upgrade buttons for Pro and Business
      expect(screen.getByRole("button", { name: /Upgrade to Pro/ })).toBeTruthy();
      expect(screen.getByRole("button", { name: /Upgrade to Business/ })).toBeTruthy();
      // Enterprise shows "Contact sales" instead
      expect(screen.getByRole("link", { name: /Contact sales/ })).toBeTruthy();
    });

    it("toggles billing cycle between monthly and yearly", async () => {
      const user = userEvent.setup();
      render(<BillingDashboard {...defaultProps} />);

      const yearlyButton = screen.getByText(/Yearly/);
      await user.click(yearlyButton);

      // After switching to yearly, pro should show $16/mo (192/12)
      expect(screen.getByText("$16")).toBeTruthy();
    });
  });

  describe("invoice history", () => {
    it("does not render invoice section when no invoices", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.queryByText("Invoice History")).toBeNull();
    });

    it("renders invoice table when invoices exist", () => {
      const invoices: Invoice[] = [
        {
          id: "inv-1",
          org_id: "org-1",
          stripe_invoice_id: "in_123",
          status: "paid",
          amount_cents: 2000,
          currency: "usd",
          period_start: "2026-01-01",
          period_end: "2026-02-01",
          hosted_invoice_url: "https://stripe.com/invoice/1",
          pdf_url: null,
          created_at: "2026-01-15T00:00:00Z",
          updated_at: "2026-01-15T00:00:00Z",
        },
      ];

      render(<BillingDashboard {...defaultProps} invoices={invoices} />);
      expect(screen.getByText("Invoice History")).toBeTruthy();
      expect(screen.getByText("$20.00")).toBeTruthy();
      expect(screen.getByText("paid")).toBeTruthy();
    });
  });

  describe("admin permissions", () => {
    it("does not show manage billing button for non-admins even with stripe customer", () => {
      render(
        <BillingDashboard
          {...defaultProps}
          subscription={makeSubscription("pro")}
          isAdmin={false}
        />,
      );
      expect(screen.queryByText("Manage billing")).toBeNull();
    });

    it("shows manage billing button for admins with stripe customer", () => {
      render(
        <BillingDashboard
          {...defaultProps}
          subscription={makeSubscription("pro")}
          isAdmin={true}
        />,
      );
      expect(screen.getByText("Manage billing")).toBeTruthy();
    });
  });
});
