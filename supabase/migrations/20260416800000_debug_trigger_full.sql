-- Debug: return full trigger source and try a test insert
DROP FUNCTION IF EXISTS debug_check_trigger();
CREATE OR REPLACE FUNCTION debug_check_trigger()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  src TEXT;
  test_org_id UUID;
  result jsonb := '{}';
BEGIN
  -- Get trigger source (check key parts)
  SELECT prosrc INTO src FROM pg_proc WHERE proname = 'handle_new_user';

  result := jsonb_build_object(
    'has_org_memberships', src LIKE '%org_memberships%',
    'has_subscriptions', src LIKE '%subscriptions%',
    'has_old_org_id', src LIKE '%user_profiles (id, org_id%',
    'has_new_style', src LIKE '%user_profiles (id, email, full_name)%',
    'has_can_approve', src LIKE '%can_approve%',
    'length', length(src)
  );

  -- Test the actual inserts
  BEGIN
    INSERT INTO public.organizations (name, plan_id)
    VALUES ('__test_debug', 'pro')
    RETURNING id INTO test_org_id;
    result := result || '{"org_insert": "ok"}'::jsonb;

    INSERT INTO public.user_profiles (id, email, full_name)
    VALUES ('00000000-0000-0000-0000-000000000001', '__test@debug.com', 'Test');
    result := result || '{"profile_insert": "ok"}'::jsonb;

    INSERT INTO public.org_memberships (user_id, org_id, role, is_default)
    VALUES ('00000000-0000-0000-0000-000000000001', test_org_id, 'owner', true);
    result := result || '{"membership_insert": "ok"}'::jsonb;

    INSERT INTO public.subscriptions (org_id, plan_id, status, trial_end, current_period_start, current_period_end)
    VALUES (test_org_id, 'pro', 'trialing', now() + interval '14 days', now(), now() + interval '14 days');
    result := result || '{"subscription_insert": "ok"}'::jsonb;

    INSERT INTO public.teams (org_id, name, created_by)
    VALUES (test_org_id, '__test_team', '00000000-0000-0000-0000-000000000001');
    result := result || '{"team_insert": "ok"}'::jsonb;
  EXCEPTION WHEN OTHERS THEN
    result := result || jsonb_build_object('error', SQLERRM, 'state', SQLSTATE);
  END;

  -- Cleanup
  DELETE FROM public.teams WHERE name = '__test_team';
  DELETE FROM public.subscriptions WHERE org_id = test_org_id;
  DELETE FROM public.org_memberships WHERE user_id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM public.user_profiles WHERE id = '00000000-0000-0000-0000-000000000001';
  DELETE FROM public.organizations WHERE id = test_org_id;

  RETURN result;
END;
$$;
