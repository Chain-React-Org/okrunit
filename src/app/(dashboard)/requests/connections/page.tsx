import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getOrgContext } from "@/lib/org-context";
import { getCachedConnectionsData, getCachedOrgLayoutData } from "@/lib/cache/queries";
import { getActiveOAuthGrants } from "@/lib/api/oauth-grants";
import { ConnectionList } from "@/components/connections/connection-list";
import { ConnectedAppsList } from "@/components/connections/connected-apps-list";
import { TierLimitBanner } from "@/components/ui/tier-limit-banner";
import { PLAN_LIMITS, isUnlimited } from "@/lib/billing/plans";
import { ExternalLink } from "lucide-react";
import type { Connection } from "@/lib/types/database";

export const metadata = {
  title: "Connections - OKrunit",
  description: "Manage your API connections and keys.",
};

const INTEGRATION_LINKS = [
  {
    name: "Zapier",
    logo: "/logos/platforms/zapier.png",
    docsPath: "/docs/integrations#zapier",
  },
  {
    name: "Make",
    logo: "/logos/platforms/make.png",
    docsPath: "/docs/integrations#make",
    // Temporary invite link while awaiting Make marketplace approval
    externalUrl: "https://www.make.com/en/hq/app-invitation/ea2fef64351d3d7c380e3ce8f64e1c69",
  },
  {
    name: "n8n",
    logo: "/logos/platforms/n8n.png",
    docsPath: "/docs/integrations#n8n",
  },
  {
    name: "GitHub Actions",
    logo: "/logos/platforms/github.png",
    docsPath: "/docs/integrations#github-actions",
  },
  {
    name: "monday.com",
    logo: "/logos/platforms/monday.png",
    docsPath: "/docs/integrations#monday",
  },
  {
    name: "Temporal",
    logo: "/logos/platforms/temporal.png",
    docsPath: "/docs/integrations#temporal",
  },
  {
    name: "Prefect",
    logo: "/logos/platforms/prefect.png",
    docsPath: "/docs/integrations#prefect",
  },
  {
    name: "Dagster",
    logo: "/logos/platforms/dagster.png",
    docsPath: "/docs/integrations#dagster",
  },
  {
    name: "Windmill",
    logo: "/logos/platforms/windmill.png",
    docsPath: "/docs/integrations#windmill",
  },
  {
    name: "Pipedream",
    logo: "/logos/platforms/pipedream.png",
    docsPath: "/docs/integrations#pipedream",
  },
];

export default async function ConnectionsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") redirect("/requests");

  const [connections, oauthGrants, { currentPlan }] = await Promise.all([
    getCachedConnectionsData(membership.org_id),
    getActiveOAuthGrants(membership.org_id),
    getCachedOrgLayoutData(membership.org_id),
  ]);

  const limits = PLAN_LIMITS[currentPlan];
  const totalConnections = connections.length + oauthGrants.length;

  return (
    <div data-tour="connection-section">
      {!isUnlimited(limits.maxConnections) && (
        <div className="mb-6">
          <TierLimitBanner
            dismissKey="connections-limit"
            planName={limits.name}
            message={`supports up to ${limits.maxConnections} connections (${totalConnections} used). Export or remove unused connections to stay within your limit.`}
          />
        </div>
      )}

      {/* Integration quick links */}
      <div className="mb-8" data-tour="setup-guides">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Setup Guides
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {INTEGRATION_LINKS.map((integration) => {
            const linkClass = "group flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3 transition-colors hover:border-border";
            const content = (
              <>
                <Image
                  src={integration.logo}
                  alt={integration.name}
                  width={24}
                  height={24}
                  className="size-6 rounded shrink-0"
                />
                <span className="text-sm font-medium flex-1 truncate">{integration.name}</span>
                <ExternalLink className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
              </>
            );

            if (integration.externalUrl) {
              return (
                <a
                  key={integration.name}
                  href={integration.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={linkClass}
                >
                  {content}
                </a>
              );
            }

            return (
              <Link
                key={integration.name}
                href={integration.docsPath}
                className={linkClass}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </div>

      {oauthGrants.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Connected Apps
          </h2>
          <ConnectedAppsList grants={oauthGrants} />
        </div>
      )}

      <div className="space-y-3">
        {oauthGrants.length > 0 && (
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            API Key Connections
          </h2>
        )}
        <ConnectionList
          initialConnections={connections as Connection[]}
        />
      </div>
    </div>
  );
}
