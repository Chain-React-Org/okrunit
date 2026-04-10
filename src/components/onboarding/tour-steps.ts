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
  /** Animated demo sequence. When present, the tour plays an interactive
   *  demo with a fake cursor driving the real UI. */
  animation?: {
    commands: import("./tour-animation-engine").AnimationCommand[];
    /** Automatically advance to next step when animation finishes */
    autoAdvance?: boolean;
    /** Default pause between commands in ms (default 300) */
    pauseBetweenCommands?: number;
  };
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
    id: "requests-demo",
    targetSelector: "[data-tour='test-request']",
    title: "Reviewing a Request",
    description:
      "Watch how to review and approve a request...",
    position: "left",
    highlightMode: "no-ring",
    animation: {
      autoAdvance: true,
      pauseBetweenCommands: 400,
      commands: [
        { type: "tooltip-update", text: "Hover over a pending request to reveal quick actions." },
        { type: "move", to: "[data-tour='test-request']" },
        { type: "wait", ms: 1200 },
        { type: "tooltip-update", text: "The Approve and Reject buttons appear on hover. Click one for a quick decision." },
        { type: "wait", ms: 1500 },
        { type: "tooltip-update", text: "Or click the card to open the detail panel for full context." },
        { type: "click", target: "[data-tour='test-request']" },
        { type: "wait", ms: 800 },
        { type: "tooltip-update", text: "The detail panel shows all request information. You can also press 'a' to approve or 'r' to reject with keyboard shortcuts." },
        { type: "wait", ms: 2500 },
        { type: "dialog-close" },
      ],
    },
  },
  {
    id: "requests-filters",
    targetSelector: "[placeholder='Search approvals...']",
    title: "Search & Filter",
    description:
      "Search by title, filter by status, priority, or source. Use the Export button to download all visible requests as CSV.",
    position: "bottom",
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
    id: "routes-config-demo",
    targetSelector: "[data-tour='flow-card']",
    title: "Configuring a Route",
    description:
      "Watch how to configure a route...",
    position: "left",
    highlightMode: "no-ring",
    animation: {
      autoAdvance: true,
      pauseBetweenCommands: 400,
      commands: [
        { type: "tooltip-update", text: "Click on a route card to expand its settings." },
        { type: "click", target: "[data-tour='flow-card'] [data-tour='flow-expand-btn']" },
        { type: "wait", ms: 800 },
        { type: "tooltip-update", text: "Here you can configure who approves requests from this source: anyone on the team, specific members, or by role." },
        { type: "wait", ms: 2500 },
        { type: "tooltip-update", text: "Set how many approvals are needed and whether they must be sequential (one after another)." },
        { type: "wait", ms: 2500 },
        { type: "tooltip-update", text: "These settings apply to all requests from this source, unless a template overrides them." },
        { type: "wait", ms: 2000 },
        // Collapse the card
        { type: "click", target: "[data-tour='flow-card'] [data-tour='flow-expand-btn']" },
      ],
    },
  },
  {
    id: "routes-templates",
    targetSelector: null,
    title: "Templates Override Routes",
    description:
      "Routes set the baseline defaults for all requests from a source. If you create a template and assign approvers or a priority to it, those template settings will override what you configured here for any request that uses that template. Think of routes as the fallback and templates as targeted overrides.",
    position: "center",
  },
];

// ---- Rules Page -----------------------------------------------------------

const rulesSteps: TourStepConfig[] = [
  {
    id: "rules-overview",
    targetSelector: null,
    title: "Conditional Rules",
    description:
      "Rules let you automatically handle requests based on conditions. Auto-approve low-risk actions, route critical requests to specific teams, or require multiple approvers. Rules are evaluated in order, first match wins.",
    position: "center",
  },
  {
    id: "rules-create-demo",
    targetSelector: null,
    title: "Creating a Rule",
    description:
      "Watch how to create a rule...",
    position: "left",
    animation: {
      autoAdvance: true,
      pauseBetweenCommands: 400,
      commands: [
        { type: "tooltip-update", text: "Click 'New Rule' to open the rule builder." },
        { type: "click", target: "[data-tour='create-rule-btn']" },
        { type: "dialog-await" },
        { type: "wait", ms: 400 },
        { type: "tooltip-update", text: "Give your rule a descriptive name so your team knows what it does." },
        { type: "move", to: "#rule-name" },
        { type: "type", target: "#rule-name", text: "Auto-approve low-risk deploys" },
        { type: "wait", ms: 600 },
        { type: "tooltip-update", text: "Set conditions like priority level. All conditions must match (AND logic). Here we select 'low' priority." },
        { type: "wait", ms: 2000 },
        { type: "tooltip-update", text: "Then choose an action: auto-approve matching requests, or route them to specific approvers with a required count." },
        { type: "wait", ms: 2500 },
        { type: "tooltip-update", text: "That's the basics! Rules are powerful. Check the Analytics page for rule suggestions based on your approval patterns." },
        { type: "wait", ms: 2000 },
        { type: "dialog-close" },
      ],
    },
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
    id: "connections-create-demo",
    targetSelector: null,
    title: "Creating a Connection",
    description:
      "Watch how to create a connection...",
    position: "left",
    animation: {
      autoAdvance: true,
      pauseBetweenCommands: 400,
      commands: [
        { type: "tooltip-update", text: "Click 'Create Connection' to set up a new API connection." },
        { type: "click", target: "[data-tour='create-connection-btn']" },
        { type: "dialog-await" },
        { type: "wait", ms: 400 },
        { type: "tooltip-update", text: "Give your connection a name, like the tool or service it represents." },
        { type: "move", to: "#connection-name" },
        { type: "type", target: "#connection-name", text: "Production Zapier" },
        { type: "wait", ms: 600 },
        { type: "tooltip-update", text: "Add an optional description to help your team identify what this connection is for." },
        { type: "move", to: "#connection-description" },
        { type: "type", target: "#connection-description", text: "Zapier workflows for production deploys" },
        { type: "wait", ms: 600 },
        { type: "tooltip-update", text: "You can set a rate limit to control how many requests this connection can send per minute." },
        { type: "wait", ms: 2000 },
        { type: "tooltip-update", text: "After creating, you'll get an API key. Use it as a Bearer token in your integration. For Zapier/Make, use OAuth instead." },
        { type: "wait", ms: 2000 },
        { type: "dialog-close" },
      ],
    },
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
    id: "messaging-demo",
    targetSelector: null,
    title: "Connecting a Channel",
    description:
      "Each platform has a one-click connect button. For Slack and Discord, you authorize via OAuth. For Telegram, you provide your bot token. For email, just enter the address. Once connected, approval notifications are sent automatically with interactive approve/reject buttons.",
    position: "center",
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

// ---- Templates Page -------------------------------------------------------

const templatesSteps: TourStepConfig[] = [
  {
    id: "templates-overview",
    targetSelector: null,
    title: "Approval Templates",
    description:
      "Templates pre-configure approval requests so your team doesn't have to fill in the same fields every time. When a template is selected in n8n, Zapier, or Make, its defaults are applied server-side.",
    position: "center",
  },
  {
    id: "templates-create-demo",
    targetSelector: null,
    title: "Creating a Template",
    description:
      "Watch how to create a template step by step...",
    position: "left",
    animation: {
      autoAdvance: true,
      pauseBetweenCommands: 350,
      commands: [
        { type: "tooltip-update", text: "Click 'Create Template' to open the template builder." },
        { type: "click", target: "[data-tour='create-template-btn']" },
        { type: "dialog-await" },
        { type: "wait", ms: 400 },

        // Select target app
        { type: "tooltip-update", text: "First, choose which platform this template is for. This controls which fields are shown." },
        { type: "select-open", trigger: "#template-target-app" },
        { type: "wait", ms: 300 },
        { type: "select-pick", item: "[role='option']:has(> span:first-child)" },
        { type: "wait", ms: 500 },

        // Type the name
        { type: "tooltip-update", text: "Give it a descriptive name. This appears in the template dropdown in your integration." },
        { type: "move", to: "#template-name" },
        { type: "type", target: "#template-name", text: "Production Deploy Approval" },
        { type: "wait", ms: 500 },

        // Type title pattern
        { type: "tooltip-update", text: "Set a default title. Use {placeholders} for dynamic values like service names." },
        { type: "move", to: "#template-title-pattern" },
        { type: "type", target: "#template-title-pattern", text: "Deploy {service} to production" },
        { type: "wait", ms: 500 },

        // Type description
        { type: "tooltip-update", text: "Add a description to provide context for reviewers." },
        { type: "move", to: "#template-description" },
        { type: "type", target: "#template-description", text: "Requires approval before deploying to production environment" },
        { type: "wait", ms: 500 },

        // Select priority
        { type: "tooltip-update", text: "Set a default priority. This is applied automatically to every request using this template." },
        { type: "select-open", trigger: "#template-priority" },
        { type: "wait", ms: 300 },
        { type: "select-pick", item: "[role='option']:nth-child(3)" },
        { type: "wait", ms: 500 },

        // Show approvers field
        { type: "tooltip-update", text: "Assign specific approvers. If set, these override the route's default approvers for requests using this template." },
        { type: "move", to: "#template-approvers" },
        { type: "wait", ms: 2000 },

        // Wrap up
        { type: "tooltip-update", text: "That's it! Click 'Create Template' to save. Your team can now select this template when creating approval requests." },
        { type: "wait", ms: 2000 },
        { type: "dialog-close" },
      ],
    },
  },
  {
    id: "templates-override",
    targetSelector: null,
    title: "How Templates Work",
    description:
      "When a request uses a template, the template's settings (title, priority, approvers) override both the route defaults and any values left blank in the integration step. Templates are powerful for standardizing approval workflows across your team.",
    position: "center",
  },
];

// ---- All Page Tours -------------------------------------------------------

export const PAGE_TOURS: PageTourConfig[] = [
  // Dashboard
  { pageId: "overview", pathname: "/org/overview", pageName: "Overview", docsPath: "/docs", steps: overviewSteps },
  { pageId: "requests", pathname: "/requests", pageName: "Requests", docsPath: "/docs/approvals", steps: requestsSteps },
  { pageId: "routes", pathname: "/requests/routes", pageName: "Routes", docsPath: "/docs/approvals", steps: routesSteps },
  { pageId: "rules", pathname: "/requests/rules", pageName: "Rules", docsPath: "/docs/rules", steps: rulesSteps },
  { pageId: "templates", pathname: "/requests/templates", pageName: "Templates", docsPath: "/docs/approvals", steps: templatesSteps },
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
  "requests", "routes", "rules", "templates", "connections", "messaging", "analytics", "sla", "audit-log",
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
