import { connection } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { OAuthClientList } from "@/components/settings/oauth-client-list";

export const metadata = {
  title: "OAuth Apps - Admin - OKrunit",
};

export default async function AdminOAuthPage() {
  await connection();
  const admin = createAdminClient();

  const { data: oauthClientsData } = await admin
    .from("oauth_clients")
    .select(
      "id, org_id, name, logo_url, client_id, client_secret_prefix, redirect_uris, scopes, is_active, created_by, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  return <OAuthClientList clients={oauthClientsData ?? []} role="owner" />;
}
