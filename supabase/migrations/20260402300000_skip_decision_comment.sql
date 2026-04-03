-- Add org-level setting to skip the decision comment prompt in messaging apps.
-- When true, approve/reject buttons apply immediately without prompting for a reason.
-- When false (default), all messaging apps prompt for an optional reason before applying.
-- Note: even when skip_decision_comment is true, if the org's rejection_reason_policy
-- requires a reason, rejections will still prompt for one.

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS skip_decision_comment boolean NOT NULL DEFAULT false;
