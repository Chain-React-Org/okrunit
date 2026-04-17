-- Debug: check what the trigger function source looks like
CREATE OR REPLACE FUNCTION debug_check_trigger()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT substring(prosrc from 200 for 400) FROM pg_proc WHERE proname = 'handle_new_user';
$$;
