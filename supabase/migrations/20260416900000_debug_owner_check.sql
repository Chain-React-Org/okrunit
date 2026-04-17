-- Debug: check function owner and RLS status
DROP FUNCTION IF EXISTS debug_check_trigger();
CREATE OR REPLACE FUNCTION debug_check_trigger()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'fn_owner', (SELECT proowner::regrole FROM pg_proc WHERE proname = 'handle_new_user'),
    'current_user', current_user,
    'session_user', session_user,
    'orgs_rls', (SELECT relrowsecurity FROM pg_class WHERE relname = 'organizations'),
    'profiles_rls', (SELECT relrowsecurity FROM pg_class WHERE relname = 'user_profiles'),
    'memberships_rls', (SELECT relrowsecurity FROM pg_class WHERE relname = 'org_memberships'),
    'subs_rls', (SELECT relrowsecurity FROM pg_class WHERE relname = 'subscriptions'),
    'teams_rls', (SELECT relrowsecurity FROM pg_class WHERE relname = 'teams'),
    'orgs_force_rls', (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'organizations'),
    'profiles_force_rls', (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'user_profiles'),
    'memberships_force_rls', (SELECT relforcerowsecurity FROM pg_class WHERE relname = 'org_memberships')
  ) INTO result;

  RETURN result;
END;
$$;
