-- ---------------------------------------------------------------------------
-- OKrunit -- Platform-level OAuth Client for Zapier
-- ---------------------------------------------------------------------------
-- Inserts a pre-registered Zapier OAuth client so users can connect their
-- Zapier integration with one click. org_id is NULL because the user selects
-- their org during the consent flow.
-- ---------------------------------------------------------------------------

INSERT INTO oauth_clients (
  name,
  org_id,
  client_id,
  client_secret_hash,
  client_secret_prefix,
  redirect_uris,
  scopes,
  is_active
) VALUES (
  'Zapier',
  NULL,
  '6698a665-26d4-4805-9695-7cb2672ab13e',
  '3b902be4721eeafc107f5c12763be9c030cddc2ca74206312daa7cf395e77cbf',
  '74d4eff2',
  ARRAY[
    'https://zapier.com/dashboard/auth/oauth/return/App*CLIAPI/',
    'https://zapier.com/dashboard/auth/oauth/return/App*API/'
  ],
  ARRAY['approvals:read', 'approvals:write', 'comments:write'],
  true
)
ON CONFLICT (client_id) DO NOTHING;
