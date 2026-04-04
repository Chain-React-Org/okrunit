-- Fix Realtime RLS evaluation for tables that use auth.uid() directly.
-- Supabase reverts GRANT USAGE ON SCHEMA auth TO supabase_realtime_admin,
-- so RLS policies using auth.uid() fail silently in the realtime context.
-- Workaround: create a SECURITY DEFINER wrapper in the public schema and
-- update RLS policies to use it instead.

-- Create a SECURITY DEFINER wrapper for auth.uid()
CREATE OR REPLACE FUNCTION public.auth_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT auth.uid()
$$;

-- Grant execute to all relevant roles
GRANT EXECUTE ON FUNCTION public.auth_user_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_id() TO supabase_realtime_admin;

-- Update in_app_notifications RLS policies to use the wrapper
DROP POLICY IF EXISTS "Users can view own notifications" ON in_app_notifications;
CREATE POLICY "Users can view own notifications"
  ON in_app_notifications FOR SELECT
  USING (auth_user_id() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON in_app_notifications;
CREATE POLICY "Users can update own notifications"
  ON in_app_notifications FOR UPDATE
  USING (auth_user_id() = user_id)
  WITH CHECK (auth_user_id() = user_id);

-- Also update request_watchers if it uses auth.uid() directly
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.request_watchers'::regclass
    AND pg_get_expr(polqual, polrelid) LIKE '%auth.uid()%'
  ) THEN
    DROP POLICY IF EXISTS "Users can view own watches" ON request_watchers;
    CREATE POLICY "Users can view own watches"
      ON request_watchers FOR SELECT
      USING (auth_user_id() = user_id);

    DROP POLICY IF EXISTS "Users can manage own watches" ON request_watchers;
    CREATE POLICY "Users can manage own watches"
      ON request_watchers FOR ALL
      USING (auth_user_id() = user_id)
      WITH CHECK (auth_user_id() = user_id);
  END IF;
END $$;
