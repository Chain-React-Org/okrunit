-- ---------------------------------------------------------------------------
-- Backfill flow creators + grant can_manage_flows for pre-existing flows
-- ---------------------------------------------------------------------------
-- The auto-grant in the approvals POST handler only fires when a NEW
-- flow is created. For flows that already existed before
-- 20260422500000_flow_creator_manage_grant shipped, infer the creator
-- from the earliest associated request's `created_by.user_id` and
-- grant them the permission if they still have an org membership.
--
-- Safe to run twice: every UPDATE is guarded by a "is NULL" or
-- "is not already true" check so re-applying the migration is a no-op.
-- ---------------------------------------------------------------------------

-- 1. Populate approval_flows.created_by_user_id from the earliest
--    approval_request that references each flow.
WITH earliest_requests AS (
  SELECT DISTINCT ON (flow_id)
    flow_id,
    (created_by ->> 'user_id')::uuid AS user_id
  FROM public.approval_requests
  WHERE flow_id IS NOT NULL
    AND created_by ? 'user_id'
    AND created_by ->> 'user_id' <> ''
  ORDER BY flow_id, created_at ASC
)
UPDATE public.approval_flows AS f
  SET created_by_user_id = er.user_id
  FROM earliest_requests AS er
  WHERE f.id = er.flow_id
    AND f.created_by_user_id IS NULL
    AND er.user_id IS NOT NULL;

-- 2. Grant can_manage_flows on the backfilled users' memberships if
--    they still have one in the flow's org. Skip rows that already
--    have the permission so nothing gets re-audited.
UPDATE public.org_memberships AS m
  SET can_manage_flows = TRUE
  FROM public.approval_flows AS f
  WHERE f.created_by_user_id = m.user_id
    AND f.org_id = m.org_id
    AND m.can_manage_flows = FALSE;
