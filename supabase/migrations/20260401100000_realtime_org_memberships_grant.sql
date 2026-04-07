-- Grant SELECT on org_memberships to supabase_realtime_admin.
-- The auth_org_id() function (used in RLS policies) queries this table.
-- Without this grant, Supabase Realtime cannot evaluate RLS for INSERT
-- events. It fails silently, dropping the event instead of delivering it.
-- DELETE events work because they match the subscription filter directly
-- without needing to evaluate the full RLS policy.

GRANT SELECT ON org_memberships TO supabase_realtime_admin;
