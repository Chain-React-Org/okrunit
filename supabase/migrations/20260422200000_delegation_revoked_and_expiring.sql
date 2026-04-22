-- Add delegation_revoked (delegator cancelled early) and delegation_expiring
-- (24h until the window ends) notification categories. Also adds
-- expiry_reminder_sent_at to approval_delegations so the cron job that sends
-- 24h warnings only fires once per delegation.

ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'delegation_revoked';
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'delegation_expiring';

ALTER TABLE approval_delegations
  ADD COLUMN IF NOT EXISTS expiry_reminder_sent_at TIMESTAMPTZ;

-- Index to make the "ending soon and reminder not sent" query fast enough
-- for a minute-granular cron.
CREATE INDEX IF NOT EXISTS idx_approval_delegations_expiry_reminder
  ON approval_delegations (ends_at)
  WHERE is_active = true AND expiry_reminder_sent_at IS NULL;
