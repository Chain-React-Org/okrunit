-- ---------------------------------------------------------------------------
-- OKrunit -- Platform-level OAuth Client for Make.com
-- ---------------------------------------------------------------------------
-- Inserts a pre-registered Make.com OAuth client so users can connect their
-- Make.com custom app with one click. org_id is NULL because the user selects
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
  'Make.com',
  NULL,
  'd7fa8ffc-44b3-4553-8cf6-c41825f2d884',
  '4b0e8ca9610acc1c1cd38a6e603e5c9c1ed6cdeb88420e7a5b25320c9468da1c',
  '8c3a2c4c',
  ARRAY['https://www.make.com/oauth/cb/app'],
  ARRAY['approvals:read', 'approvals:write', 'comments:write'],
  true
)
ON CONFLICT (client_id) DO NOTHING;
