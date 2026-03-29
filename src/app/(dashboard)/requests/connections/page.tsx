import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getOrgContext } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { getActiveOAuthGrants } from "@/lib/api/oauth-grants";
import { ConnectionList } from "@/components/connections/connection-list";
import { ConnectedAppsList } from "@/components/connections/connected-apps-list";
import { ExternalLink } from "lucide-react";
import type { Connection } from "@/lib/types/database";

export const metadata = {
  title: "Connections - OKRunit",
  description: "Manage your API connections and keys.",
};

const CONNECTION_COLUMNS =
  "id, org_id, name, description, api_key_prefix, is_active, rate_limit_per_hour, allowed_action_types, max_priority, scoping_rules, last_used_at, rotated_at, created_by, created_at, updated_at" as const;

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
  },
  {
    name: "n8n",
    logo: "/logos/platforms/n8n.png",
    docsPath: "/docs/integrations#n8n",
  },
  {
    name: "monday.com",
    logo: "/logos/platforms/monday.png",
    docsPath: "/docs/integrations#monday",
  },
];

export default async function ConnectionsPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  if (membership.role !== "owner" && membership.role !== "admin") redirect("/requests");

  const supabase = await createClient();

  const [{ data: connections }, oauthGrants] = await Promise.all([
    supabase
      .from("connections")
      .select(CONNECTION_COLUMNS)
      .eq("org_id", membership.org_id)
      .order("created_at", { ascending: false })
      .returns<Omit<Connection, "api_key_hash">[]>(),
    getActiveOAuthGrants(membership.org_id),
  ]);

  return (
    <div>
      {/* Integration quick links */}
      <div className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Setup Guides
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {INTEGRATION_LINKS.map((integration) => (
            <Link
              key={integration.name}
              href={integration.docsPath}
              className="group flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3 transition-colors hover:border-border"
            >
              <Image
                src={integration.logo}
                alt={integration.name}
                width={24}
                height={24}
                className="size-6 rounded shrink-0"
              />
              <span className="text-sm font-medium flex-1 truncate">{integration.name}</span>
              <ExternalLink className="size-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0" />
            </Link>
          ))}
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
          initialConnections={(connections ?? []) as Connection[]}
        />
      </div>
    </div>
  );
}
