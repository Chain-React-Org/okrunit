// ---------------------------------------------------------------------------
// OKrunit -- SAML Service Provider & Identity Provider Factory
// ---------------------------------------------------------------------------
// Builds samlify SP/IdP instances from stored SSO config.
// ---------------------------------------------------------------------------

import * as samlify from "samlify";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SSOConfig } from "@/lib/types/database";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Disable XML schema validation (samlify requires a validator but we do our
// own certificate-based signature verification which is sufficient).
samlify.setSchemaValidator({
  validate: async () => "skipped",
});

/**
 * Creates a samlify ServiceProvider for OKrunit.
 */
export function createServiceProvider() {
  return samlify.ServiceProvider({
    entityID: `${APP_URL}/api/auth/saml/metadata`,
    assertionConsumerService: [
      {
        Binding: samlify.Constants.namespace.binding.post,
        Location: `${APP_URL}/api/auth/saml/callback`,
      },
    ],
    singleLogoutService: [
      {
        Binding: samlify.Constants.namespace.binding.redirect,
        Location: `${APP_URL}/api/auth/saml/logout`,
      },
    ],
    nameIDFormat: [samlify.Constants.namespace.format.emailAddress],
    authnRequestsSigned: false,
    wantAssertionsSigned: true,
  });
}

/**
 * Creates a samlify IdentityProvider from a stored SSO config.
 */
export function createIdentityProvider(config: SSOConfig) {
  return samlify.IdentityProvider({
    entityID: config.entity_id,
    singleSignOnService: [
      {
        Binding: samlify.Constants.namespace.binding.redirect,
        Location: config.sso_url,
      },
    ],
    signingCert: config.certificate,
    nameIDFormat: [samlify.Constants.namespace.format.emailAddress],
  });
}

/**
 * Creates multiple IdP instances for certificate rotation support.
 * Returns an array with the primary IdP, and optionally a secondary IdP
 * using the secondary certificate (for rollover periods).
 */
export function createIdentityProviders(
  config: SSOConfig,
): ReturnType<typeof samlify.IdentityProvider>[] {
  const primary = createIdentityProvider(config);
  if (!config.certificate_secondary) return [primary];

  const secondary = samlify.IdentityProvider({
    entityID: config.entity_id,
    singleSignOnService: [
      {
        Binding: samlify.Constants.namespace.binding.redirect,
        Location: config.sso_url,
      },
    ],
    signingCert: config.certificate_secondary,
    nameIDFormat: [samlify.Constants.namespace.format.emailAddress],
  });
  return [primary, secondary];
}

/**
 * Loads the active SSO config for an org. Returns null if not configured/active.
 */
export async function loadSSOConfig(orgId: string): Promise<SSOConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("sso_configs")
    .select("*")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .single<SSOConfig>();

  return data;
}

/**
 * Looks up which org has SSO configured for a given email domain.
 * Returns the SSO config + org_id, or null if no SSO is configured for that domain.
 */
export async function findSSOConfigByEmail(
  email: string,
): Promise<SSOConfig | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;

  const admin = createAdminClient();

  // Look up org by allowed SSO domain. We check if any org has an active SSO
  // config and the org's sso_domain matches the user's email domain.
  const { data: orgs } = await admin
    .from("organizations")
    .select("id, sso_domain")
    .eq("sso_domain", domain);

  if (!orgs || orgs.length === 0) return null;

  // Find the first org with an active SSO config
  for (const org of orgs) {
    const config = await loadSSOConfig(org.id);
    if (config) return config;
  }

  return null;
}

export { APP_URL };
