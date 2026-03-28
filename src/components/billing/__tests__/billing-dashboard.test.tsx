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
    global.fetch = vi.fn();
  });

  describe("subscription section", () => {
    it("renders the subscription section with plan name", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Subscription")).toBeTruthy();
      expect(screen.getByText("My plan")).toBeTruthy();
      // Plan name appears in badge and elsewhere — use getAllByText
      expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
    });

    it("renders Pro badge for pro plan", () => {
      render(
        <BillingDashboard
          {...defaultProps}
          subscription={makeSubscription("pro")}
        />,
      );
      expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("usage rows", () => {
    it("displays request usage with progress", () => {
      render(<BillingDashboard {...defaultProps} />);
      // The "Requests" label in the subscription table
      expect(screen.getByText("Requests")).toBeTruthy();
      expect(screen.getByText(/42 \/ 100 used/)).toBeTruthy();
    });

    it("displays connection usage", () => {
      render(<BillingDashboard {...defaultProps} />);
      // "Connections" appears in subscription table and comparison — use getAllByText
      expect(screen.getAllByText("Connections").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText(/1 \/ 2 active/)).toBeTruthy();
    });

    it("displays team member usage", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Team")).toBeTruthy();
      expect(screen.getByText(/2 \/ 3 members/)).toBeTruthy();
    });

    it("shows 'used' label for unlimited plan requests", () => {
      render(
        <BillingDashboard
          {...defaultProps}
          subscription={makeSubscription("pro")}
        />,
      );
      expect(screen.getByText(/42 used/)).toBeTruthy();
    });
  });

  describe("compare plans section", () => {
    it("renders all 4 plan cards", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.getByText("Compare Plans")).toBeTruthy();
      expect(screen.getAllByText("Free").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Pro").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Business").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Enterprise").length).toBeGreaterThanOrEqual(1);
    });

    it("highlights current plan", () => {
      render(<BillingDashboard {...defaultProps} />);
      // "Your plan" appears as badge and in comparison table header
      expect(screen.getAllByText("Your plan").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Your current plan")).toBeTruthy();
    });

    it("shows buy buttons for higher plans and contact for enterprise", () => {
      render(<BillingDashboard {...defaultProps} />);
      // On free plan, should see yearly buy buttons for Pro and Business by default.
      const buyButtons = screen.getAllByRole("button", { name: /Buy yearly plan/ });
      expect(buyButtons.length).toBeGreaterThanOrEqual(2);
      // Enterprise shows "Talk to sales"
      expect(screen.getByText(/Talk to sales/)).toBeTruthy();
    });

    it("toggles billing cycle between yearly and monthly", async () => {
      const user = userEvent.setup();
      render(<BillingDashboard {...defaultProps} />);

      // Yearly is the default recovered behavior.
      expect(screen.getAllByRole("button", { name: /Buy yearly plan/ }).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("$16")).toBeTruthy();

      // Click the toggle to switch to monthly.
      const toggle = screen.getByText(/Yearly/);
      const toggleButton = toggle.closest("div")?.querySelector("button");
      if (toggleButton) await user.click(toggleButton);

      expect(screen.getAllByRole("button", { name: /Buy monthly plan/ }).length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("$20")).toBeTruthy();
    });
  });

  describe("invoice history", () => {
    it("does not render invoice section when no invoices", () => {
      render(<BillingDashboard {...defaultProps} />);
      expect(screen.queryByText("Payments")).toBeNull();
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
      // Look for the payments section
      expect(screen.getByText("Payments")).toBeTruthy();
      expect(screen.getByText("$20.00")).toBeTruthy();
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
