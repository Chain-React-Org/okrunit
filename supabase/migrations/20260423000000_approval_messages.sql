-- ---------------------------------------------------------------------------
-- approval_messages
-- ---------------------------------------------------------------------------
-- Stores platform-native message references for approval request messages
-- sent to messaging apps. Used to edit the original message in place when
-- the request is decided (approved/rejected/cancelled) so the recipient
-- sees "Approved by Alice" where the interactive buttons used to be.
--
-- Supported today:
--   telegram: chat_id + message_id  (Bot API editMessageText)
--   discord:  webhook_url + message_id (PATCH /webhooks/{id}/{token}/messages/{id})
--
-- Slack and Teams incoming webhooks don't return a message reference, so
-- proactive edits aren't supported for those platforms without a bot-level
-- OAuth migration. We fall back to stale-click cleanup via response_url.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS approval_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  connection_id UUID REFERENCES messaging_connections(id) ON DELETE SET NULL,
  platform TEXT NOT NULL CHECK (platform IN ('slack', 'teams', 'discord', 'telegram')),
  -- Platform-specific fields. Only the ones relevant to the platform are set.
  channel_id TEXT,       -- Telegram chat_id, Discord channel id
  message_id TEXT,       -- Telegram message_id, Discord message id
  webhook_url TEXT,      -- Discord webhook URL used to send (needed for PATCH)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup by approval so "on decide" edits are fast.
CREATE INDEX IF NOT EXISTS idx_approval_messages_approval
  ON approval_messages (approval_id);

-- Lookup by connection (for reporting, e.g. "messages posted by this Slack install").
CREATE INDEX IF NOT EXISTS idx_approval_messages_connection
  ON approval_messages (connection_id)
  WHERE connection_id IS NOT NULL;

ALTER TABLE approval_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members read approval_messages"
  ON approval_messages FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

-- Writes only happen server-side via the admin client, so no insert/update
-- policies needed beyond the admin service role.

GRANT SELECT ON approval_messages TO supabase_realtime_admin;
