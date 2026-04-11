-- Index for efficient decided_after/decided_before filtering on the approvals API.
-- Partial index: only rows with a decision are included, keeping it small.
CREATE INDEX IF NOT EXISTS idx_approval_requests_org_decided
  ON approval_requests(org_id, decided_at DESC)
  WHERE decided_at IS NOT NULL;
