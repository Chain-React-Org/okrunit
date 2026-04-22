-- ---------------------------------------------------------------------------
-- Add `can_manage_flows` permission to org memberships
-- ---------------------------------------------------------------------------
-- Gates who can edit approval flows (PATCH/DELETE on /api/v1/flows/[id])
-- and reassign approvers on an in-flight request
-- (POST /api/v1/approvals/reassign).
--
-- There is *no* role-based escape hatch: if an owner or admin is revoked
-- this permission, they lose flow-management ability. Other owners/admins
-- can grant the permission back to them (or to a fresh delegate) via the
-- team members endpoint, so the responsibility can move between people
-- when someone is out.
--
-- Backfill: owner + admin roles start with the permission on so the
-- upgrade doesn't silently break any existing workflow.
-- ---------------------------------------------------------------------------

ALTER TABLE public.org_memberships
  ADD COLUMN IF NOT EXISTS can_manage_flows BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.org_memberships
  SET can_manage_flows = TRUE
  WHERE role IN ('owner', 'admin');

CREATE INDEX IF NOT EXISTS idx_org_memberships_can_manage_flows
  ON public.org_memberships(org_id, can_manage_flows)
  WHERE can_manage_flows = TRUE;

-- Mirror on custom_roles so organizations with custom role definitions
-- can also express this permission.
ALTER TABLE public.custom_roles
  ADD COLUMN IF NOT EXISTS can_manage_flows BOOLEAN NOT NULL DEFAULT FALSE;
