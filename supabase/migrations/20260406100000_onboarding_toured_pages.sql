-- Persist per-page tour completion so it survives logout/login.
-- Previously only stored in localStorage which got wiped on sync.
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_toured_pages TEXT[] DEFAULT '{}';
