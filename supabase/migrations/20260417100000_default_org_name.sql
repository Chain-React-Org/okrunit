-- Default org name to "My Organization" instead of "{name}'s Organization"
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_record RECORD;
  new_org_id UUID;
  resolved_name TEXT;
BEGIN
  resolved_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_username'), ''),
    ''
  );

  SELECT * INTO invite_record
  FROM public.org_invites
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF invite_record IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, email, full_name, setup_completed_at)
    VALUES (NEW.id, NEW.email, resolved_name, now());

    INSERT INTO public.org_memberships (user_id, org_id, role, is_default, can_approve, can_connect)
    VALUES (
      NEW.id,
      invite_record.org_id,
      invite_record.role,
      true,
      COALESCE(invite_record.can_approve, false),
      COALESCE(invite_record.can_connect, false)
    );

    UPDATE public.org_invites SET accepted_at = now() WHERE id = invite_record.id;
  ELSE
    INSERT INTO public.organizations (name, plan_id)
    VALUES ('My Organization', 'pro')
    RETURNING id INTO new_org_id;

    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, resolved_name);

    INSERT INTO public.org_memberships (user_id, org_id, role, is_default)
    VALUES (NEW.id, new_org_id, 'owner', true);

    INSERT INTO public.subscriptions (org_id, plan_id, status, trial_end, current_period_start, current_period_end)
    VALUES (
      new_org_id,
      'pro',
      'trialing',
      now() + interval '14 days',
      now(),
      now() + interval '14 days'
    );

    INSERT INTO public.teams (org_id, name, created_by)
    VALUES (new_org_id, 'My Team', NEW.id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
