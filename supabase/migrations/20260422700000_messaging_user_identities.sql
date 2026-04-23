-- ---------------------------------------------------------------------------
-- messaging_user_identities
-- ---------------------------------------------------------------------------
-- Maps a platform-native identifier (Slack user id, Teams AAD id, Discord user
-- id, Telegram user id) to an OKrunit user. Required so inbound Approve/Reject
-- clicks from messaging apps can be attributed to a real user and run through
-- the same permission pipeline as the web app (assigned_approvers, sequential
-- turn, self-approval block, four-eyes, delegation).
--
-- Seeded automatically on OAuth install (installer's platform id -> their
-- OKrunit user id) and on Telegram /start via link nonce.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS messaging_user_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'teams', 'discord', 'telegram')),
  external_user_id TEXT NOT NULL,
  external_username TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A given platform id belongs to at most one user per org. We scope by org
  -- because a single person could belong to multiple orgs and be mapped in
  -- each; the inbound handler resolves using the connection's org.
  UNIQUE(org_id, platform, external_user_id)
);

-- Lookup by (platform, external_user_id) inside an org (the inbound handler
-- already knows the org via the incoming webhook / messaging_connection).
CREATE INDEX IF NOT EXISTS idx_messaging_user_identities_platform_external
  ON messaging_user_identities (platform, external_user_id);

-- Lookup by user: "which platforms is this user linked on"
CREATE INDEX IF NOT EXISTS idx_messaging_user_identities_user
  ON messaging_user_identities (user_id);

ALTER TABLE messaging_user_identities ENABLE ROW LEVEL SECURITY;

-- Org members can see identity rows in their org (for "who's linked" UI).
CREATE POLICY "Org members read own-org identities"
  ON messaging_user_identities FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

-- Users can add their own mapping (for future Settings-side linking flows).
CREATE POLICY "Users manage own identity"
  ON messaging_user_identities FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- supabase_realtime_admin needs SELECT to dispatch events through RLS when
-- we eventually want realtime on this table.
GRANT SELECT ON messaging_user_identities TO supabase_realtime_admin;
