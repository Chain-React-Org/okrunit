-- ---------------------------------------------------------------------------
-- OKrunit -- Per-theme auto-approve flags for tweet automation
-- ---------------------------------------------------------------------------
-- When a per-theme auto-approve flag is true, generated drafts of that theme
-- skip the approval queue and are saved directly as 'approved'. The cron
-- still posts them at their scheduled_for time, and notification still fires
-- so the founder sees what was scheduled (with "auto-posting" framing).
-- ---------------------------------------------------------------------------

ALTER TABLE tweet_config
  ADD COLUMN auto_approve_feature BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN auto_approve_lesson BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN auto_approve_use_case BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN auto_approve_milestone BOOLEAN NOT NULL DEFAULT false;
