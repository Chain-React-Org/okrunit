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
  'ba776c2f-8539-482c-8f74-793fc310e794',
  '180f655185a5d9b29b1a630bb70be43f806ec33636be03e96ed9cbb95a3a6852',
  'b6c90a1e',
  ARRAY[
    'https://zapier.com/dashboard/auth/oauth/return/App*CLIAPI/',
    'https://zapier.com/dashboard/auth/oauth/return/App*API/'
  ],
  ARRAY['approvals:read', 'approvals:write', 'comments:write'],
  true
)
ON CONFLICT (client_id) DO NOTHING;
