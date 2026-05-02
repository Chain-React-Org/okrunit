-- ---------------------------------------------------------------------------
-- OKrunit -- Tweet Automation
-- ---------------------------------------------------------------------------
-- Admin-only system that generates draft tweets via AI Gateway, sends them
-- through messaging connections (Slack/Discord/Telegram/Teams) for approval,
-- and posts approved drafts to Twitter on a configurable schedule.
--
-- All tables are app-level (no org_id) and locked to is_app_admin.
-- ---------------------------------------------------------------------------

-- 1. tweet_brief (singleton row): the curated app context the AI uses to
-- generate tweets. Holds product description, voice samples, hot takes,
-- shipped features, and any other context.
CREATE TABLE tweet_brief (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  app_description TEXT NOT NULL DEFAULT '',
  voice_guidelines TEXT NOT NULL DEFAULT '',
  shipped_features TEXT NOT NULL DEFAULT '',
  hot_takes TEXT NOT NULL DEFAULT '',
  use_cases TEXT NOT NULL DEFAULT '',
  do_not_mention TEXT NOT NULL DEFAULT '',
  example_tweets TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tweet_brief_singleton CHECK (id = true)
);

-- 2. tweet_config (singleton row): scheduling, model, channels, image config.
CREATE TABLE tweet_config (
  id BOOLEAN PRIMARY KEY DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT false,
  -- Slot times in 24h UTC, e.g. ["14:00","17:00","20:00"] (default 10am ET = 14:00 UTC, 1pm ET = 17:00 UTC)
  posting_slots TEXT[] NOT NULL DEFAULT ARRAY['14:00','17:00']::TEXT[],
  -- Days of week the bot runs (0=Sun, 6=Sat)
  posting_days INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
  -- Lead time for generation (minutes before scheduled post). Allows time for review.
  generation_lead_minutes INTEGER NOT NULL DEFAULT 60,
  -- Model selection via AI Gateway: provider/model
  model TEXT NOT NULL DEFAULT 'google/gemini-2.5-flash',
  fallback_model TEXT NOT NULL DEFAULT 'anthropic/claude-sonnet-4-6',
  -- Theme mix percentages (must sum to 100)
  theme_feature_pct INTEGER NOT NULL DEFAULT 40,
  theme_lesson_pct INTEGER NOT NULL DEFAULT 25,
  theme_use_case_pct INTEGER NOT NULL DEFAULT 20,
  theme_milestone_pct INTEGER NOT NULL DEFAULT 15,
  -- Notification target: which messaging connection ids to ping for approval.
  -- NULL or empty = all active connections.
  notify_connection_ids UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],
  -- Whether to auto-regenerate when a draft is rejected
  auto_regenerate_on_reject BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tweet_config_singleton CHECK (id = true),
  CONSTRAINT tweet_config_theme_sum CHECK (
    theme_feature_pct + theme_lesson_pct + theme_use_case_pct + theme_milestone_pct = 100
  )
);

-- 3. tweet_drafts: generated drafts and their lifecycle.
CREATE TABLE tweet_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  -- Original generated content (preserved across edits)
  original_content TEXT NOT NULL,
  theme TEXT NOT NULL CHECK (theme IN ('feature', 'lesson', 'use_case', 'milestone')),
  status TEXT NOT NULL DEFAULT 'pending_approval' CHECK (
    status IN ('pending_approval', 'approved', 'posted', 'rejected', 'failed', 'expired')
  ),
  scheduled_for TIMESTAMPTZ NOT NULL,
  posted_at TIMESTAMPTZ,
  twitter_post_id TEXT,
  twitter_post_url TEXT,
  rejection_reason TEXT,
  failure_reason TEXT,
  edited_by UUID REFERENCES auth.users(id),
  edited_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  -- Generation metadata: model used, prompt tokens, completion tokens, etc.
  generation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tweet_drafts_status ON tweet_drafts(status);
CREATE INDEX idx_tweet_drafts_scheduled_for ON tweet_drafts(scheduled_for);
CREATE INDEX idx_tweet_drafts_status_scheduled ON tweet_drafts(status, scheduled_for);

-- 4. RLS: app admins only.
ALTER TABLE tweet_brief ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE tweet_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App admins can manage tweet_brief"
  ON tweet_brief FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_app_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_app_admin = true
    )
  );

CREATE POLICY "App admins can manage tweet_config"
  ON tweet_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_app_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_app_admin = true
    )
  );

CREATE POLICY "App admins can manage tweet_drafts"
  ON tweet_drafts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_app_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_app_admin = true
    )
  );

-- 5. updated_at trigger (uses existing helper if present, else inline)
CREATE OR REPLACE FUNCTION set_tweet_automation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER tweet_brief_updated_at BEFORE UPDATE ON tweet_brief
  FOR EACH ROW EXECUTE FUNCTION set_tweet_automation_updated_at();

CREATE TRIGGER tweet_config_updated_at BEFORE UPDATE ON tweet_config
  FOR EACH ROW EXECUTE FUNCTION set_tweet_automation_updated_at();

CREATE TRIGGER tweet_drafts_updated_at BEFORE UPDATE ON tweet_drafts
  FOR EACH ROW EXECUTE FUNCTION set_tweet_automation_updated_at();

-- 6. Seed singleton rows
INSERT INTO tweet_brief (id) VALUES (true) ON CONFLICT DO NOTHING;
INSERT INTO tweet_config (id) VALUES (true) ON CONFLICT DO NOTHING;
