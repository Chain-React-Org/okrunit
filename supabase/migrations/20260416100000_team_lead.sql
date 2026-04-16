-- Add team lead support
-- A team lead can invite new org members to their team, add/remove existing
-- org members from their team, and assign positions within their team.

-- 1. Add is_lead flag to team_memberships
ALTER TABLE team_memberships
  ADD COLUMN is_lead BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_team_memberships_is_lead
  ON team_memberships(team_id, is_lead) WHERE is_lead = true;

-- 2. Add team_lead_ids to org_invites so the inviter can pre-assign
--    team lead status for specific teams at invite time.
--    This is a JSONB array of team IDs (subset of team_ids) where
--    the invitee should be made a team lead on acceptance.
ALTER TABLE org_invites
  ADD COLUMN team_lead_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
