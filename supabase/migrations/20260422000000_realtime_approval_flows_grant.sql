-- Grant SELECT on approval_flows to supabase_realtime_admin so the Realtime
-- server can evaluate the table's RLS policy when dispatching INSERT/UPDATE
-- events to subscribed clients on the Routes page.

GRANT SELECT ON approval_flows TO supabase_realtime_admin;
