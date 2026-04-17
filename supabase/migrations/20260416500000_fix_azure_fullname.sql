-- Fix handle_new_user trigger to extract full_name from multiple metadata
-- fields. Microsoft/Azure returns "name" instead of "full_name".

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_record RECORD;
  new_org_id UUID;
  resolved_name TEXT;
BEGIN
  -- Resolve full name from various OAuth provider metadata fields.
  -- Google/GitHub use "full_name", Microsoft/Azure uses "name".
  resolved_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_username'), ''),
    ''
  );

  -- Check if user was invited to an existing org
  SELECT * INTO invite_record
  FROM org_invites
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_record IS NOT NULL THEN
    -- Join existing org via invite
    INSERT INTO user_profiles (id, org_id, email, full_name, role)
    VALUES (
      NEW.id,
      invite_record.org_id,
      NEW.email,
      resolved_name,
      invite_record.role
    );

    -- Mark invite as accepted
    UPDATE org_invites SET accepted_at = now() WHERE id = invite_record.id;
  ELSE
    -- Create new org for this user
    INSERT INTO organizations (name)
    VALUES (COALESCE(NULLIF(resolved_name, ''), NEW.email) || '''s Organization')
    RETURNING id INTO new_org_id;

    INSERT INTO user_profiles (id, org_id, email, full_name, role)
    VALUES (
      NEW.id,
      new_org_id,
      NEW.email,
      resolved_name,
      'owner'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing users who have an empty full_name but have a name
-- in their auth metadata (e.g. Microsoft users).
UPDATE user_profiles
SET full_name = COALESCE(
  NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
  NULLIF(TRIM(u.raw_user_meta_data->>'preferred_username'), ''),
  ''
)
FROM auth.users u
WHERE user_profiles.id = u.id
  AND (user_profiles.full_name IS NULL OR TRIM(user_profiles.full_name) = '')
  AND (
    NULLIF(TRIM(u.raw_user_meta_data->>'name'), '') IS NOT NULL
    OR NULLIF(TRIM(u.raw_user_meta_data->>'preferred_username'), '') IS NOT NULL
  );
