-- ---------------------------------------------------------------------------
-- OKrunit -- Org-wide "allow self-approval" toggle
-- ---------------------------------------------------------------------------
-- When true, users may decide on approval requests they created themselves.
-- Defaults to false to preserve segregation of duties (the current behavior).
-- Admins can turn it on from Org Settings.
-- ---------------------------------------------------------------------------

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS allow_self_approval boolean NOT NULL DEFAULT false;
