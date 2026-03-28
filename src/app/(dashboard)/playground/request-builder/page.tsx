import { redirect } from "next/navigation";
import { getOrgContext } from "@/lib/org-context";
import { createClient } from "@/lib/supabase/server";
import { RequestBuilder } from "@/components/playground/request-builder";
import type { Connection } from "@/lib/types/database";

export const metadata = {
  title: "Request Builder - OKrunit",
  description: "Interactively test the OKrunit API with pre-built templates and live request/response inspection.",
};

const CONNECTION_COLUMNS =
  "id, org_id, name, description, api_key_prefix, is_active, rate_limit_per_hour, allowed_action_types, max_priority, scoping_rules, last_used_at, rotated_at, created_by, created_at, updated_at" as const;

export default async function RequestBuilderPage() {
  const ctx = await getOrgContext();
  if (!ctx) redirect("/login");
  const { membership } = ctx;

  const supabase = await createClient();

  const { data: activeConnections } = await supabase
    .from("connections")
    .select(CONNECTION_COLUMNS)
    .eq("org_id", membership.org_id)
    .eq("is_active", true)
    .order("name", { ascending: true })
    .returns<Omit<Connection, "api_key_hash">[]>();

  return <RequestBuilder connections={(activeConnections ?? []) as Connection[]} />;
}
