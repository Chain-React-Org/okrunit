-- ---------------------------------------------------------------------------
-- OKRunit -- Platform-level OAuth Client for n8n
-- ---------------------------------------------------------------------------
-- Allows org_id to be NULL for platform-level OAuth clients (n8n, Zapier, Make)
-- where the user selects their org during the consent flow.
-- Inserts a pre-registered n8n OAuth client so users can connect with one click.
-- ---------------------------------------------------------------------------

-- Allow platform-level clients without an org
ALTER TABLE oauth_clients ALTER COLUMN org_id DROP NOT NULL;

-- Insert the n8n platform OAuth client
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
  'n8n',
  NULL,
  'dca0b43b-51e4-4782-96b1-bd2d20fc509b',
  '3e63be7d5343d581155d12755d5f5426a6f61fd50f10be604750fe8a69c1049b',
  'db1d3d64',
  ARRAY[
    'http://localhost:5678/rest/oauth2-credential/callback',
    'https://*.app.n8n.cloud/rest/oauth2-credential/callback'
  ],
  ARRAY['approvals:read', 'approvals:write', 'comments:write'],
  true
);
