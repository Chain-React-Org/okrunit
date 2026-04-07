// ---------------------------------------------------------------------------
// OKrunit -- Per-Page Tour Step Definitions
// ---------------------------------------------------------------------------

export interface TourStepConfig {
  id: string;
  targetSelector: string | null;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  highlightMode?: "default" | "full-width" | "no-ring";
  actionLabel?: string;
}

export interface PageTourConfig {
  pageId: string;
  pathname: string;
  pageName: string;
  docsPath: string;
  steps: TourStepConfig[];
}

// ---- Overview Page --------------------------------------------------------

const overviewSteps: TourStepConfig[] = [
  {
    id: "overview-stats",
    targetSelector: null,
    title: "Organization Overview",
    description:
      "Your dashboard shows key stats at a glance: pending requests, approval count, approval rate, active connections, and team members. Click any stat to navigate to the relevant page.",
    position: "center",
  },
  {
    id: "overview-activity",
    targetSelector: "[data-tour='overview-main']",
    title: "Your Dashboard",
    description:
      "This is your main dashboard. At the top is your organization name, followed by key stat widgets (pending requests, approval rate, connections, and members). Below that is the recent activity feed showing the latest approval requests with their status, priority, and source.",
    position: "center",
    highlightMode: "no-ring",
  },
  {
    id: "overview-search-palette",
    targetSelector: "[data-tour='search-bar']",
    title: "Search Palette",
    description:
      "Press \u2318K (Ctrl+K on Windows) from anywhere to open the search palette. Quickly find requests, navigate between pages, or run common actions without leaving the keyboard.",
    position: "bottom",
  },
];

// ---- Requests Page --------------------------------------------------------

const requestsSteps: TourStepConfig[] = [
  {
    id: "requests-overview",
    targetSelector: null,
    title: "Requests Page",
    description:
      "This is where all approval requests appear. Pending requests that need your attention are always shown at the top. Resolved requests appear below.",
    position: "center",
  },
  {
    id: "requests-hover-actions",
    targetSelector: "[data-tour='test-request']",
    title: "Quick Actions on Hover",
    description:
      "Hover over any pending request to reveal Approve and Reject buttons directly on the card \u2014 no need to open the detail panel for quick decisions.",
    position: "bottom",
  },
  {
    id: "requests-three-dots",
    targetSelector: "[data-tour='test-request-more-menu']",
    title: "More Options",
    description:
      "The three-dot menu (visible on hover) lets you archive the request, configure the flow, or open the full detail panel for more context.",
    position: "left",
  },
  {
    id: "requests-filters",
    targetSelector: "[placeholder='Search approvals...']",
    title: "Search & Filter",
    description:
      "Search by title, filter by status, priority, or source. Use the Export button to download all visible requests as CSV.",
    position: "bottom",
  },
  {
    id: "requests-keyboard",
    targetSelector: "[data-tour='detail-panel']",
    title: "Keyboard Shortcuts",
    description:
      "With the detail panel open like this, press 'a' to approve or 'r' to reject instantly.",
    position: "left",
    highlightMode: "no-ring",
  },
];

// ---- Routes Page ----------------------------------------------------------

const routesSteps: TourStepConfig[] = [
  {
    id: "routes-overview",
    targetSelector: null,
    title: "Approval Routes",
    description:
      "Routes define how requests from each source are handled. Each card represents a source (like a Zapier Zap or API connection). Routes are created automatically when the first request arrives from a source.",
    position: "center",
  },
  {
    id: "routes-config",
    targetSelector: "[data-tour='flow-card']",
    title: "Configure a Route",
    description:
      "Click the gear icon on any route card to configure: who approves (team or specific users), how many approvals are needed, whether to use sequential chains, and the default priority.",
    position: "bottom",
  },
];

// ---- Rules Page -----------------------------------------------------------

const rulesSteps: TourStepConfig[] = [
  {
    id: "rules-overview",
    targetSelector: null,
    title: "Conditional Rules",
    description:
      "Rules let you automatically handle requests based on conditions. Auto-approve low-risk actions, route critical requests to specific teams, or require multiple approvers. Rules are evaluated in order \u2014 first match wins.",
    position: "center",
  },
  {
    id: "rules-create",
    targetSelector: null,
    title: "Creating Rules",
    description:
      "Click 'New Rule' to create a rule. Set conditions (priority, action type, source, title pattern) and an action (auto-approve or route to a team/users with a required approval count). OKrunit also suggests rules on the Analytics page based on your approval history.",
    position: "center",
  },
];

// ---- Connections Page -----------------------------------------------------

const connectionsSteps: TourStepConfig[] = [
  {
    id: "connections-overview",
    targetSelector: null,
    title: "Connections",
    description:
      "Connections are how external tools authenticate with OKRunit. Each connection has an API key for direct API access. You can also connect via OAuth from platforms like Zapier and Make.",
    position: "center",
  },
  {
    id: "connections-guides",
    targetSelector: "[data-tour='setup-guides']",
    title: "Integration Guides",
    description:
      "Click any platform logo for step-by-step setup instructions. For API access, create a connection and use the API key with Bearer token authentication.",
    position: "bottom",
  },
];

// ---- Messaging Page -------------------------------------------------------

const messagingSteps: TourStepConfig[] = [
  {
    id: "messaging-overview",
    targetSelector: "[data-tour='messaging-section']",
    title: "Notification Channels",
    description:
      "Connect Slack, Discord, Microsoft Teams, or Telegram to receive approval notifications with interactive approve/reject buttons. Email and web push are enabled by default.",
    position: "bottom",
  },
  {
    id: "messaging-routing",
    targetSelector: null,
    title: "Notification Routing",
    description:
      "Each channel can be configured with routing rules to only receive notifications for specific sources, action types, or priority levels. This prevents notification noise.",
    position: "center",
  },
];

// ---- Analytics Page -------------------------------------------------------

const analyticsSteps: TourStepConfig[] = [
  {
    id: "analytics-overview",
    targetSelector: null,
    title: "Analytics Dashboard",
    description:
      "Track approval volume, approval rates, and response times over the last 30 days. The charts update as new requests come in.",
    position: "center",
  },
  {
    id: "analytics-patterns",
    targetSelector: null,
    title: "Pattern Suggestions",
    description:
      "Scroll down to see pattern suggestions \u2014 OKRunit analyzes your approval history and recommends auto-approve rules for requests that are consistently approved (90%+ rate, 10+ decisions).",
    position: "center",
  },
];

// ---- SLA Page -------------------------------------------------------------

const slaSteps: TourStepConfig[] = [
  {
    id: "sla-overview",
    targetSelector: null,
    title: "SLA Configuration",
    description:
      "Set response time targets for each priority level. When a pending request exceeds its SLA deadline, it gets flagged and alert banners appear on the overview page.",
    position: "center",
  },
  {
    id: "sla-escalation",
    targetSelector: null,
    title: "Escalation & Alerts",
    description:
      "Configure escalation rules so requests that breach SLA deadlines are automatically reassigned or escalated to managers. Email and push notifications are sent when deadlines approach.",
    position: "center",
  },
];

// ---- Audit Log Page -------------------------------------------------------

const auditLogSteps: TourStepConfig[] = [
  {
    id: "audit-overview",
    targetSelector: null,
    title: "Audit Log",
    description:
      "Every action in OKRunit is recorded here \u2014 approvals, rejections, rule changes, team updates, and more. Use filters to search by actor, action type, or date range.",
    position: "center",
  },
  {
    id: "audit-export",
    targetSelector: null,
    title: "Export & Compliance",
    description:
      "Export audit logs as CSV for compliance reporting. The log is immutable \u2014 entries cannot be edited or deleted, ensuring a complete audit trail.",
    position: "center",
  },
];

// ---- Organizations Page ---------------------------------------------------

const organizationsSteps: TourStepConfig[] = [
  {
    id: "orgs-overview",
    targetSelector: null,
    title: "Your Organizations",
    description:
      "This page shows all organizations you belong to. You can switch between organizations or create a new one. Each organization has its own requests, connections, teams, and settings.",
    position: "center",
  },
  {
    id: "orgs-switch",
    targetSelector: null,
    title: "Switching Organizations",
    description:
      "Click on any organization card to switch to it. You can also use the organization switcher in the sidebar to quickly jump between orgs without coming to this page.",
    position: "center",
  },
];

// ---- Teams Page -----------------------------------------------------------

const teamsSteps: TourStepConfig[] = [
  {
    id: "teams-overview",
    targetSelector: null,
    title: "Teams",
    description:
      "Teams let you group members for approval routing. When a request is assigned to a team, any member of that team can approve it. Create teams based on departments, projects, or approval responsibilities.",
    position: "center",
  },
  {
    id: "teams-routing",
    targetSelector: null,
    title: "Team-Based Routing",
    description:
      "Assign teams to approval routes or rules so requests are automatically routed to the right group. Team members receive notifications and can approve from any connected channel.",
    position: "center",
  },
];

// ---- Members Page ---------------------------------------------------------

const membersSteps: TourStepConfig[] = [
  {
    id: "members-overview",
    targetSelector: null,
    title: "Team Members",
    description:
      "Manage who has access to your organization. Each member has a role (Owner, Admin, Approver, or Member) that determines their permissions. Owners and Admins can invite new members.",
    position: "center",
  },
  {
    id: "members-roles",
    targetSelector: null,
    title: "Roles & Permissions",
    description:
      "Approvers can approve or reject requests. Admins can also manage settings, connections, and rules. Owners have full control including billing and member management.",
    position: "center",
  },
];

// ---- Invites Page ---------------------------------------------------------

const invitesSteps: TourStepConfig[] = [
  {
    id: "invites-overview",
    targetSelector: null,
    title: "Pending Invitations",
    description:
      "View and manage outstanding invitations to your organization. You can resend invites, copy invite links, or revoke invitations that haven\u2019t been accepted yet.",
    position: "center",
  },
];

// ---- Roles Page -----------------------------------------------------------

const rolesSteps: TourStepConfig[] = [
  {
    id: "roles-overview",
    targetSelector: null,
    title: "Custom Roles",
    description:
      "Define custom roles beyond the built-in Owner, Admin, Approver, and Member roles. Custom roles let you fine-tune permissions for specific workflows or compliance requirements.",
    position: "center",
  },
];

// ---- Org Settings Page ----------------------------------------------------

const orgSettingsSteps: TourStepConfig[] = [
  {
    id: "org-settings-overview",
    targetSelector: null,
    title: "Organization Settings",
    description:
      "Configure your organization name, default approval settings, rejection reason policies, and security options like IP allowlists and geo-restrictions.",
    position: "center",
  },
  {
    id: "org-settings-security",
    targetSelector: null,
    title: "Security & Policies",
    description:
      "Set organization-wide policies: require rejection reasons, enable re-authentication for critical approvals, configure four-eyes principle enforcement, and set bottleneck alert thresholds.",
    position: "center",
  },
];

// ---- Billing Page ---------------------------------------------------------

const billingSteps: TourStepConfig[] = [
  {
    id: "billing-overview",
    targetSelector: null,
    title: "Billing & Subscription",
    description:
      "View your current plan, usage, and billing history. Upgrade to unlock more connections, team members, and features like SSO, analytics export, and custom routing.",
    position: "center",
  },
];

// ---- Account Settings Page ------------------------------------------------

const accountSettingsSteps: TourStepConfig[] = [
  {
    id: "account-overview",
    targetSelector: null,
    title: "Account Settings",
    description:
      "Manage your personal account: update your name, email, and notification preferences. You can also set up passkeys for passwordless authentication.",
    position: "center",
  },
];

// ---- Notification Settings Page -------------------------------------------

const notificationSettingsSteps: TourStepConfig[] = [
  {
    id: "notification-settings-overview",
    targetSelector: null,
    title: "Notification Preferences",
    description:
      "Choose how you want to be notified about approval requests. Configure email, push notification, and in-app notification settings. You can set quiet hours to pause notifications.",
    position: "center",
  },
];

// ---- Playground Page ------------------------------------------------------

const playgroundSteps: TourStepConfig[] = [
  {
    id: "playground-overview",
    targetSelector: null,
    title: "API Playground",
    description:
      "Test the OKRunit API directly from your browser. Create approval requests, check their status, and see how the API responds \u2014 all without writing code.",
    position: "center",
  },
  {
    id: "playground-builder",
    targetSelector: null,
    title: "Request Builder",
    description:
      "Use the request builder to construct API calls visually. Set the title, priority, metadata, and other fields, then send the request to see the result.",
    position: "center",
  },
];

// ---- Webhook Deliveries Page -----------------------------------------------

const webhookDeliveriesSteps: TourStepConfig[] = [
  {
    id: "deliveries-overview",
    targetSelector: null,
    title: "Webhook Deliveries",
    description:
      "This page shows every outbound webhook that OKRunit fires when an approval decision is made. Each row is a single delivery attempt to your configured webhook URL.",
    position: "center",
  },
  {
    id: "deliveries-filters",
    targetSelector: "[data-tour='delivery-filters']",
    title: "Filter Deliveries",
    description:
      "Filter by status (success or failed), connection, and time range to find specific deliveries. The count on the right shows how many match your current filters.",
    position: "bottom",
  },
  {
    id: "deliveries-table",
    targetSelector: "[data-tour='delivery-table']",
    title: "Delivery Details",
    description:
      "Click any row to expand it and see the full request and response: headers, body, status code, and duration. Failed deliveries show the error message and can be retried with the Retry button.",
    position: "bottom",
    highlightMode: "no-ring",
  },
];

// ---- All Page Tours -------------------------------------------------------

export const PAGE_TOURS: PageTourConfig[] = [
  // Dashboard
  { pageId: "overview", pathname: "/org/overview", pageName: "Overview", docsPath: "/docs", steps: overviewSteps },
  { pageId: "requests", pathname: "/requests", pageName: "Requests", docsPath: "/docs/approvals", steps: requestsSteps },
  { pageId: "routes", pathname: "/requests/routes", pageName: "Routes", docsPath: "/docs/approvals", steps: routesSteps },
  { pageId: "rules", pathname: "/requests/rules", pageName: "Rules", docsPath: "/docs/rules", steps: rulesSteps },
  { pageId: "connections", pathname: "/requests/connections", pageName: "Connections", docsPath: "/docs/integrations", steps: connectionsSteps },
  { pageId: "messaging", pathname: "/requests/messaging", pageName: "Messaging", docsPath: "/docs/notifications", steps: messagingSteps },
  { pageId: "analytics", pathname: "/requests/analytics", pageName: "Analytics", docsPath: "/docs/approvals", steps: analyticsSteps },
  { pageId: "sla", pathname: "/requests/sla", pageName: "SLA", docsPath: "/docs/sla", steps: slaSteps },
  { pageId: "audit-log", pathname: "/requests/audit-log", pageName: "Audit Log", docsPath: "/docs/approvals", steps: auditLogSteps },

  // Organization
  { pageId: "organizations", pathname: "/org/organizations", pageName: "Organizations", docsPath: "/docs/onboarding", steps: organizationsSteps },
  { pageId: "teams", pathname: "/org/teams", pageName: "Teams", docsPath: "/docs/approvals", steps: teamsSteps },
  { pageId: "members", pathname: "/org/members", pageName: "Members", docsPath: "/docs/custom-roles", steps: membersSteps },
  { pageId: "invites", pathname: "/org/invites", pageName: "Invites", docsPath: "/docs/onboarding", steps: invitesSteps },
  { pageId: "roles", pathname: "/org/roles", pageName: "Roles", docsPath: "/docs/custom-roles", steps: rolesSteps },
  { pageId: "org-settings", pathname: "/org/settings", pageName: "Org Settings", docsPath: "/docs", steps: orgSettingsSteps },
  { pageId: "billing", pathname: "/org/billing", pageName: "Billing", docsPath: "/docs/billing", steps: billingSteps },

  // Settings
  { pageId: "account", pathname: "/settings/account", pageName: "Account", docsPath: "/docs/passkeys", steps: accountSettingsSteps },
  { pageId: "notifications", pathname: "/settings/notifications", pageName: "Notifications", docsPath: "/docs/notifications", steps: notificationSettingsSteps },

  // Dev tools
  { pageId: "playground", pathname: "/playground", pageName: "Playground", docsPath: "/docs/api", steps: playgroundSteps },
  { pageId: "webhook-deliveries", pathname: "/playground/webhook-deliveries", pageName: "Webhook Deliveries", docsPath: "/docs/webhooks", steps: webhookDeliveriesSteps },
];

// Full tour order (for the sequential "Start Tour" flow)
// Follows sidebar order: Org pages → Requests pages → Playground → Settings
export const FULL_TOUR_ORDER = [
  // Org section
  "overview", "organizations", "teams", "members", "invites", "roles", "org-settings", "billing",
  // Requests section
  "requests", "routes", "rules", "connections", "messaging", "analytics", "sla", "audit-log",
  // Playground
  "playground", "webhook-deliveries",
  // Settings
  "account", "notifications",
];

// Legacy export for backward compat
export const TOUR_STEPS = PAGE_TOURS.flatMap((p) =>
  p.steps.map((s) => ({ ...s, pathname: p.pathname, actionLabel: s.actionLabel ?? "Next" })),
);

// Helper: find tour config for a given pathname
// Prefers exact matches, then longest prefix match to avoid greedy matching
// (e.g. /requests/connections should match connections tour, not requests tour)
export function findPageTour(pathname: string): PageTourConfig | undefined {
  // Try exact match first
  const exact = PAGE_TOURS.find((p) => p.pathname === pathname);
  if (exact) return exact;

  // Fall back to longest prefix match
  let best: PageTourConfig | undefined;
  for (const p of PAGE_TOURS) {
    if (pathname.startsWith(p.pathname + "/")) {
      if (!best || p.pathname.length > best.pathname.length) {
        best = p;
      }
    }
  }
  return best;
}
