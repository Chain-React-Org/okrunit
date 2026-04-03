// ---------------------------------------------------------------------------
// OKrunit -- OAuth 2.0 Authorization / Consent Page
// ---------------------------------------------------------------------------

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ConsentForm } from "./consent-form";

interface AuthorizePageProps {
  searchParams: Promise<{
    response_type?: string;
    client_id?: string;
    redirect_uri?: string;
    scope?: string;
    state?: string;
    code_challenge?: string;
    code_challenge_method?: string;
  }>;
}

export default async function AuthorizePage({ searchParams }: AuthorizePageProps) {
  const params = await searchParams;

  // Validate required parameters.
  if (params.response_type !== "code") {
    return (
      <ErrorDisplay
        error="unsupported_response_type"
        description='Only "code" response type is supported.'
      />
    );
  }

  if (!params.client_id) {
    return (
      <ErrorDisplay
        error="invalid_request"
        description="Missing client_id parameter."
      />
    );
  }

  if (!params.redirect_uri) {
    return (
      <ErrorDisplay
        error="invalid_request"
        description="Missing redirect_uri parameter."
      />
    );
  }

  // Get the current user.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // This shouldn't happen — middleware redirects to login.
    redirect("/login");
  }

  const admin = createAdminClient();

  // Look up the OAuth client.
  const { data: client } = await admin
    .from("oauth_clients")
    .select("client_id, name, logo_url, redirect_uris, scopes, is_active, org_id")
    .eq("client_id", params.client_id)
    .single();

  if (!client || !client.is_active) {
    return (
      <ErrorDisplay
        error="invalid_client"
        description="Unknown or inactive application."
      />
    );
  }

  // Verify redirect_uri.
  if (!client.redirect_uris.includes(params.redirect_uri)) {
    return (
      <ErrorDisplay
        error="invalid_redirect_uri"
        description="The redirect URI is not registered for this application."
      />
    );
  }

  // Get all user org memberships so they can choose which org to connect.
  const { data: allMemberships } = await admin
    .from("org_memberships")
    .select("org_id, role, is_default")
    .eq("user_id", user.id)
    .order("is_default", { ascending: false });

  if (!allMemberships || allMemberships.length === 0) {
    return (
      <ErrorDisplay
        error="no_membership"
        description="Your account is not associated with any organization."
      />
    );
  }

  // Default to the user's default org
  const membership = allMemberships.find((m) => m.is_default) ?? allMemberships[0];

  // Fetch all org names
  const orgIds = allMemberships.map((m) => m.org_id);
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, name")
    .in("id", orgIds);

  const orgMap = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const orgOptions = allMemberships.map((m) => ({
    id: m.org_id,
    name: orgMap.get(m.org_id) ?? "Unknown",
    role: m.role,
  }));

  // Parse and validate requested scopes.
  // Handle space-separated, +-separated, and comma-separated scopes.
  const requestedScopes = params.scope
    ? params.scope.split(/[\s,+]+/).filter(Boolean)
    : [...client.scopes];
  const grantedScopes = requestedScopes.filter((s: string) =>
    client.scopes.includes(s),
  );

  // Fall back to client's default scopes if parsing yielded nothing valid
  // (e.g. Make.com sending scope as [object Object]).
  if (grantedScopes.length === 0) {
    grantedScopes.push(...client.scopes);
  }

  // Get user profile for account display on consent screen.
  const { data: profile } = await admin
    .from("user_profiles")
    .select("email, full_name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <ConsentForm
      clientName={client.name}
      clientLogoUrl={client.logo_url || null}
      orgName={orgMap.get(membership.org_id) || "Your Organization"}
      scopes={grantedScopes}
      clientId={params.client_id}
      redirectUri={params.redirect_uri}
      state={params.state || ""}
      codeChallenge={params.code_challenge || ""}
      codeChallengeMethod={params.code_challenge_method || ""}
      userId={user.id}
      orgId={membership.org_id}
      userEmail={profile?.email || user.email || ""}
      userFullName={profile?.full_name || null}
      userAvatarUrl={profile?.avatar_url || null}
      orgOptions={orgOptions.length > 1 ? orgOptions : undefined}
    />
  );
}

function ErrorDisplay({
  error,
  description,
}: {
  error: string;
  description: string;
}) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Authorization Error</h1>
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">{error}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
}
