-- Add optional team_ids to org_invites so invitees can be auto-added to teams
ALTER TABLE org_invites
  ADD COLUMN team_ids JSONB DEFAULT '[]'::jsonb;

-- Update handle_new_user() to also add user to teams when accepting an invite
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_record RECORD;
  new_org_id UUID;
  tid TEXT;
BEGIN
  -- Check if user was invited to an existing org
  SELECT * INTO invite_record
  FROM public.org_invites
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_record IS NOT NULL THEN
    -- Create user profile
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );

    -- Create membership in the invited org
    INSERT INTO public.org_memberships (user_id, org_id, role, is_default)
    VALUES (NEW.id, invite_record.org_id, invite_record.role, true);

    -- Auto-add to teams if team_ids were specified
    IF invite_record.team_ids IS NOT NULL AND jsonb_array_length(invite_record.team_ids) > 0 THEN
      FOR tid IN SELECT jsonb_array_elements_text(invite_record.team_ids)
      LOOP
        INSERT INTO public.team_memberships (team_id, user_id)
        VALUES (tid::uuid, NEW.id)
        ON CONFLICT (team_id, user_id) DO NOTHING;
      END LOOP;
    END IF;

    -- Mark invite as accepted
    UPDATE public.org_invites SET accepted_at = now() WHERE id = invite_record.id;
  ELSE
    -- Create new org for this user
    INSERT INTO public.organizations (name)
    VALUES (split_part(NEW.email, '@', 1) || '''s Org')
    RETURNING id INTO new_org_id;

    -- Create user profile
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
    );

    -- Create owner membership
    INSERT INTO public.org_memberships (user_id, org_id, role, is_default, can_approve)
    VALUES (NEW.id, new_org_id, 'owner', true, true);

    -- Create default team
    INSERT INTO public.teams (org_id, name, created_by)
    VALUES (new_org_id, 'My Team', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
