import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Complete version history and release notes for OKrunit.",
};

const releases = [
  {
    version: "v1.2.0",
    date: "March 31, 2026",
    label: "Documentation & Polish",
    changes: [
      "Complete docs overhaul with 11 new guide pages covering every feature",
      "Docs navigation restructured into 5 sections with grouped categories",
      "Search bar in header with platform-aware shortcut (⌘K on Mac, Ctrl+K on Windows)",
      "SLA metric tooltips explaining Compliance, Tracked, Breached, and Avg Response",
      "SLA page 'Edit Targets' button linking directly to org settings",
      "SLA demo mode with realistic mock data (?demo=true)",
      "Email improvements: removed [OKrunit] subject prefix, org name in footers, fixed logo background",
      "Loading skeletons on 6 pages that were showing blank during load",
      "Error boundaries on 4 route groups for graceful error recovery",
      "Sitemap expanded with 5 new public pages",
      "Blog posts now link to changelog instead of 'Coming soon'",
      "Status page metadata fix for proper SEO",
      "Command palette accessibility fix (Radix Dialog title for screen readers)",
    ],
  },
  {
    version: "v1.1.0",
    date: "March 30, 2026",
    label: "Major Feature Release",
    changes: [
      // Error monitoring
      "Built-in error monitoring system (Sentry-equivalent) with error grouping, Discord alerts, and admin dashboard",
      "Error fingerprinting groups duplicate errors by normalized stack trace (SHA-256 hash)",
      "Discord error webhooks with rate-limited alerts for new errors and regressions",
      "Admin error dashboard with filters, search, resolve/ignore/reopen actions",
      "'Copy for AI' button on error detail page for one-click copy of error context for debugging",
      "Client-side error capture via window.onerror and unhandledrejection handlers",
      "React error boundary for component crashes",
      "Global error handlers registered via Next.js instrumentation hook",
      // Escalation
      "Multi-level approval escalation with configurable delay and target per level",
      "Escalation targets: remind approvers, notify admins, notify specific team, or specific users",
      "Vercel Cron scheduling for escalation (every 5 minutes), weekly digest, account purge, and data retention",
      "Escalation settings UI in org settings with add/remove levels",
      // Conditional routing
      "Conditional routing rules with source and risk-level conditions",
      "Rules can override required_approvals count (e.g. 'if critical, require 3 approvers')",
      "Rules management UI at /requests/rules with create/edit/delete dialog",
      "Pattern conditions: priority levels, action types (with wildcards), sources, risk levels, title regex",
      // Performance
      "Consolidated 3 separate COUNT queries into 1 on overview page",
      "Parallelized waterfall queries on overview page (connection names + creator profiles)",
      "Narrowed SELECT * to specific columns in approval dashboard client fetch",
      "Cache-Control headers on analytics API (60s fresh, 5min stale-while-revalidate)",
      "Rate limiting on batch approve/reject endpoint (20 req/min per IP)",
      "Added composite database index on approval_requests(org_id, status, created_at DESC)",
      "React.memo on ApprovalCard (362 lines) and FlowCard (1,056 lines)",
      "Code-split landing page with next/dynamic",
      "Converted all docs screenshots from PNG to WebP (7.8MB → 2.7MB, 65% reduction)",
      "Skip auth validation on public routes in middleware (saves ~50-100ms)",
      // Realtime
      "Live notification bell badge via Supabase Realtime on in_app_notifications table",
      "Live pending count on sidebar badge that updates when approvals are created/decided",
      "Fixed useRealtime hook race condition in React strict mode",
      // Plan & billing
      "Added maxTeams limit to plan tiers (Free=1, Pro=5, Business/Enterprise=unlimited)",
      "Moved SSO/SAML from Business to Enterprise tier",
      "Added new plan features: api_access, scheduled_approvals, ip_allowlist, geo_restrictions, webhook_retry_config",
      "Updated billing dashboard with teams row and comparison table",
      // Org & teams
      "Org switcher dropdown in header when user has 2+ organizations",
      "Team creation disabled with tooltip on free plan",
      "Connections counter fixed to count both API keys AND OAuth grants",
      // Other features
      "SLA compliance dashboard with per-priority breakdown and progress bars",
      "OpenAPI 3.1 specification at /openapi.json linked from API docs",
      "Approval pattern detection that suggests auto-approve rules based on history",
      "Webhook retry button on failed deliveries in delivery log",
      "Structured JSON logger with performance timing",
      "Integration tests for error fingerprinting (9 tests) and escalation logic (7 tests)",
      // Round 2 features
      "Command palette (Cmd+K / Ctrl+K) for global search across pages and approvals",
      "Data retention cron job for daily cleanup of old webhook logs, error events, expired OAuth codes",
      "Health check endpoint at /api/health with Supabase connectivity verification",
      "Content Security Policy header added to all pages",
      "CSV export button on requests page",
      "Keyboard shortcuts: press 'a' to approve, 'r' to reject in detail view",
      "Configurable rejection presets on organizations",
      "Public pricing page at /pricing",
      "Terms of Service page at /terms",
      "System status page at /status with live health checks",
      "Blog section at /blog",
      "Newsletter email capture in footer",
      "Dashboard alert banners for SLA breaches and escalated requests",
      "Interactive onboarding tutorial with 5 guided steps and test data cleanup",
      "Breadcrumb JSON-LD schema on docs pages",
      "Session management: sign out all other sessions",
      "Per-day quiet hours for notification scheduling",
      "Approval reassign API for changing approvers on pending requests",
      "PWA support: manifest, app icons, installable on mobile",
      "Email bounce tracking via Resend webhooks with auto-disable on hard bounce",
      "Notification history page with category filters",
      "Accessibility: skip-to-content link, aria-labels on sidebar buttons",
      "Custom roles with named definitions mapping to permission levels",
      "FIDO2/WebAuthn passkey support for hardware keys and biometrics",
    ],
  },
  {
    version: "v1.0.0",
    date: "March 2026",
    label: "Launch",
    changes: [
      "Core approval request management with real-time updates",
      "19 platform integrations (Zapier, Make, n8n, GitHub Actions, LangChain, Temporal, Prefect, Dagster, Windmill, Pipedream, and more)",
      "Multi-step approval chains with sequential and parallel modes",
      "Billing with 4 tiers: Free ($0), Pro ($20/mo), Business ($60/mo), Enterprise (custom)",
      "SSO/SAML with provider-specific guides (Okta, Azure AD, Google Workspace)",
      "Trust engine with auto-approve after N consecutive approvals",
      "Risk scoring with automatic four-eyes principle for critical actions",
      "Approval conditions with webhook-based checks before execution",
      "Scheduled execution: approve now, execute later",
      "7 notification channels: Email, Slack, Discord, Teams, Telegram, Web Push, In-App",
      "Notification routing rules per messaging connection",
      "Approval flows with per-source routing defaults",
      "SLA tracking with per-priority deadlines",
      "Bottleneck detection and workload distribution analysis",
      "Emergency stop to instantly hold all incoming approvals",
      "IP allowlist and geo-restrictions for dashboard access",
      "OAuth 2.0 authorization server for third-party integrations",
      "Webhook delivery log with request/response inspection",
      "Audit log with CSV export",
      "Full-text search on approval titles",
      "Saved filters with defaults",
      "Request archiving with bulk operations",
      "Approval attachments and file uploads",
      "Email one-click approve/reject with secure action tokens",
      "Interactive Slack/Discord/Teams buttons for decisions",
      "Make.com-inspired responsive UI with dark sidebar",
    ],
  },
  {
    version: "v0.9.0",
    date: "March 2026",
    label: "Beta",
    changes: [
      "Core approval workflow engine with pending/approved/rejected status lifecycle",
      "Email, Slack, Discord, Teams, and Telegram notification channels",
      "Analytics dashboard with volume charts, approval rate, and response time trends",
      "Setup wizard with 3-step onboarding flow",
      "Web push notifications with service worker",
    ],
  },
  {
    version: "v0.8.0",
    date: "February 2026",
    label: "Alpha",
    changes: [
      "REST API with OAuth 2.0 and API key authentication",
      "Webhook callbacks with HMAC-SHA256 signing and exponential backoff retries",
      "Rules engine for automatic routing and auto-approval",
      "Row-level security across all database tables",
      "Input validation with Zod schemas on all API endpoints",
    ],
  },
  {
    version: "v0.7.0",
    date: "January 2026",
    label: "Internal Preview",
    changes: [
      "Initial dashboard with approval list and detail panel",
      "Team management and role-based access control (Owner, Admin, Approver, Member)",
      "Audit log for all approval actions with actor tracking",
      "Connection management for API keys and OAuth clients",
      "Multi-organization support with org switching",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div>
      <BreadcrumbJsonLd items={[{ name: "Docs", href: "/docs" }, { name: "Changelog", href: "/docs/changelog" }]} />

      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">Changelog</h1>
      <p className="mt-2 text-base text-zinc-500">
        A complete history of every update, feature, and improvement in OKrunit.
      </p>

      <div className="mt-10 space-y-0">
        {releases.map((release, i) => (
          <div key={release.version} className="relative flex gap-6">
            {/* Timeline line */}
            <div className="flex flex-col items-center">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500 bg-emerald-50">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
              {i < releases.length - 1 && (
                <div className="w-px flex-1 bg-zinc-200" />
              )}
            </div>

            {/* Content */}
            <div className="pb-10">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-lg font-bold text-zinc-900">{release.version}</span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  {release.label}
                </span>
                <span className="text-sm text-zinc-400">{release.date}</span>
              </div>
              <ul className="mt-3 space-y-2">
                {release.changes.map((change) => (
                  <li key={change} className="flex items-start gap-2 text-sm text-zinc-600">
                    <svg className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
