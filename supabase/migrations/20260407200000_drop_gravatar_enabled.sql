-- Drop gravatar_enabled column (Gravatar is now used automatically as fallback)
ALTER TABLE user_profiles DROP COLUMN IF EXISTS gravatar_enabled;
