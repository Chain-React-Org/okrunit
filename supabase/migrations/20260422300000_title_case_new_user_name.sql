-- Normalize provider-supplied full_name to title case inside handle_new_user
-- so OAuth signups land in the DB as "Nathaniel Stoddard" rather than
-- whatever casing the provider happened to return ("nathaniel stoddard" from
-- Google OIDC, "NATHANIEL STODDARD" from SAML, etc.).
--
-- Postgres's built-in initcap() handles the standard cases: whitespace
-- becomes a word boundary ("anne marie" -> "Anne Marie"), as do hyphens
-- ("anne-marie" -> "Anne-Marie") and apostrophes ("o'brien" -> "O'Brien").
-- It matches the JS titleCaseName() helper used on the app side for new
-- profile saves, so the two normalization paths stay in sync.

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

  -- Title-case whatever we resolved. Empty string (no name provided) stays
  -- empty so the app still falls back to the email address in display.
  IF resolved_name <> '' THEN
    resolved_name := initcap(resolved_name);
  END IF;

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
    VALUES (NEW.id, NEW.email, resolved_name);

    -- Create membership in the invited org with permissions from invite
    INSERT INTO public.org_memberships (user_id, org_id, role, is_default, can_approve, can_connect)
    VALUES (
      NEW.id,
      invite_record.org_id,
      invite_record.role,
      true,
      COALESCE(invite_record.can_approve, false),
      COALESCE(invite_record.can_connect, false)
    );

    -- Mark invite as accepted
    UPDATE public.org_invites SET accepted_at = now() WHERE id = invite_record.id;
  ELSE
    -- Create new org with Pro plan (trial)
    INSERT INTO public.organizations (name, plan_id)
    VALUES (COALESCE(NULLIF(resolved_name, ''), NEW.email) || '''s Organization', 'pro')
    RETURNING id INTO new_org_id;

    -- Create user profile
    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, resolved_name);

    -- Create membership as owner
    INSERT INTO public.org_memberships (user_id, org_id, role, is_default)
    VALUES (NEW.id, new_org_id, 'owner', true);

    -- Create Pro trial subscription (14 days, no Stripe subscription yet)
    INSERT INTO public.subscriptions (org_id, plan_id, status, trial_end, current_period_start, current_period_end)
    VALUES (
      new_org_id,
      'pro',
      'trialing',
      now() + interval '14 days',
      now(),
      now() + interval '14 days'
    );

    -- Create default team
    INSERT INTO public.teams (org_id, name, created_by)
    VALUES (new_org_id, 'My Team', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
