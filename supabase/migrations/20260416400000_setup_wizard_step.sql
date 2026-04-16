-- Track setup wizard progress in the database so it persists across
-- devices and browser sessions.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS setup_wizard_step INTEGER NOT NULL DEFAULT 0;
