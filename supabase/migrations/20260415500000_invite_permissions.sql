-- Add can_approve and can_connect to org_invites
-- Allows admins to pre-configure permissions when inviting members.
-- These values are applied to the org_membership when the invite is accepted.

ALTER TABLE org_invites
  ADD COLUMN can_approve BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN can_connect BOOLEAN NOT NULL DEFAULT false;
