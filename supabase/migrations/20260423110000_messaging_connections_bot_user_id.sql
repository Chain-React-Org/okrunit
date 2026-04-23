-- Add bot_user_id so Slack (and later Teams) can record the bot identity
-- returned by oauth.v2.access. Used when filtering bot-authored events and
-- debugging which bot posted a given message.

ALTER TABLE messaging_connections
  ADD COLUMN IF NOT EXISTS bot_user_id TEXT;
