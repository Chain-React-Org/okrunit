import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Changelog",
  description: "OKRunit version history and release notes.",
};

const releases = [
  {
    version: "v1.0.0",
    date: "March 2026",
    label: "Launch",
    changes: [
      "Approval request management with real-time updates",
      "19 platform integrations (Zapier, Make, n8n, GitHub Actions, LangChain, Windmill, Pipedream, Temporal, Prefect, Dagster, and more)",
      "Multi-step approval chains with department routing",
      "Billing with 4 tiers (Free, Pro, Business, Enterprise)",
      "SSO/SAML for Business and Enterprise plans",
      "Make.com-style responsive UI with dark theme",
    ],
  },
  {
    version: "v0.9.0",
    date: "March 2026",
    label: "Beta",
    changes: [
      "Core approval workflow engine",
      "Email, Slack, Discord, Teams, and Telegram notifications",
      "Analytics dashboard with approval metrics",
      "Setup wizard for onboarding new organizations",
    ],
  },
  {
    version: "v0.8.0",
    date: "February 2026",
    label: "Alpha",
    changes: [
      "REST API with OAuth 2.0 and API key authentication",
      "Webhook callbacks with HMAC signing and retry logic",
      "Rules engine for automatic routing and escalation",
      "Row-level security across all database tables",
    ],
  },
  {
    version: "v0.7.0",
    date: "January 2026",
    label: "Internal Preview",
    changes: [
      "Initial dashboard with approval list and detail views",
      "Team management and role-based access control",
      "Audit log for all approval actions",
      "Connection management for API keys and OAuth clients",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
        Changelog
      </h1>
      <p className="mt-2 text-base text-zinc-500">
        A history of updates, improvements, and new features in OKRunit.
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
                <span className="text-lg font-bold text-zinc-900">
                  {release.version}
                </span>
                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                  {release.label}
                </span>
                <span className="text-sm text-zinc-400">{release.date}</span>
              </div>
              <ul className="mt-3 space-y-2">
                {release.changes.map((change) => (
                  <li
                    key={change}
                    className="flex items-start gap-2 text-sm text-zinc-600"
                  >
                    <svg
                      className="mt-1 h-3.5 w-3.5 shrink-0 text-emerald-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M5 13l4 4L19 7"
                      />
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
