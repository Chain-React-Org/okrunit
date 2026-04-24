-- Backfill misrouted "flow_assigned" notifications.
--
-- Before the fix, these notifications were stored with resource_type =
-- 'approval_request' and resource_id = <approval_id>, which made the UI route
-- clicks to /requests?open=<id> instead of the routes page. Re-point them at
-- the owning flow so the link works.
UPDATE in_app_notifications AS n
SET
  resource_type = 'approval_flow',
  resource_id   = ar.flow_id
FROM approval_requests AS ar
WHERE n.category       = 'flow_assigned'
  AND n.resource_type  = 'approval_request'
  AND n.resource_id    = ar.id
  AND ar.flow_id IS NOT NULL;
