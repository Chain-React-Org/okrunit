-- ---------------------------------------------------------------------------
-- messaging_link_nonces
-- ---------------------------------------------------------------------------
-- One-time-use tokens handed to unlinked users when they click Approve /
-- Reject from Slack / Teams / Discord / Telegram (inline bot) without a
-- linked OKrunit account. The token carries the caller's platform identity;
-- consuming it from the /link landing page binds that identity to the
-- signed-in OKrunit user and writes a messaging_user_identities row.
--
-- Short-lived (10 min) so a stolen link becomes useless quickly. Scoped to
-- an org at creation time — we know which org the messaging connection
-- belongs to.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS messaging_link_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nonce TEXT NOT NULL UNIQUE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'teams', 'discord', 'telegram')),
  external_user_id TEXT NOT NULL,
  external_username TEXT,
  consumed_at TIMESTAMPTZ,
  consumed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by nonce value from the /link page
CREATE INDEX IF NOT EXISTS idx_messaging_link_nonces_nonce
  ON messaging_link_nonces (nonce);

-- Cleanup helper: expired + unconsumed
CREATE INDEX IF NOT EXISTS idx_messaging_link_nonces_expires
  ON messaging_link_nonces (expires_at)
  WHERE consumed_at IS NULL;

ALTER TABLE messaging_link_nonces ENABLE ROW LEVEL SECURITY;

-- Anyone with the raw nonce can read the row via the server API — we do not
-- need broad SELECT access. Keep RLS strict.
CREATE POLICY "Users read their own consumed nonces"
  ON messaging_link_nonces FOR SELECT
  USING (consumed_by = auth.uid());

GRANT SELECT ON messaging_link_nonces TO supabase_realtime_admin;
