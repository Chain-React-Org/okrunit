-- ---------------------------------------------------------------------------
-- Track the human behind a flow's first request + auto-grant them
-- Manage Flows permission
-- ---------------------------------------------------------------------------
-- When an approval request arrives and no flow exists for its source,
-- one is auto-created. The human associated with the inbound request
-- (API connection owner, OAuth user, etc.) becomes the logical owner of
-- that flow — they're the one who brought the integration online.
--
-- We record that user on the flow (`created_by_user_id`) so the UI can
-- surface them, and the approvals POST handler grants them
-- `can_manage_flows` at creation time so they don't have to ask an
-- admin for rights to configure something they just wired up.
-- ---------------------------------------------------------------------------

ALTER TABLE public.approval_flows
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_approval_flows_created_by_user
  ON public.approval_flows(created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;
