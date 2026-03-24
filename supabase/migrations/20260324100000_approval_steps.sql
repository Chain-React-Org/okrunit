-- ============================================================================
-- Multi-Step Approval Chains
-- Enables sequential approval workflows where different steps require
-- different approvers (e.g., IT Team → Manager → Director)
-- ============================================================================

-- Step definitions for an approval request
CREATE TABLE approval_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL, -- 1, 2, 3... (execution order)
  name TEXT NOT NULL, -- e.g., "IT Review", "Manager Approval", "Director Sign-off"
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'active', 'approved', 'rejected', 'skipped')),
  -- Who can approve this step (at least one must be set)
  assigned_team_id UUID REFERENCES teams(id) ON DELETE SET NULL, -- any team member can approve
  assigned_user_ids UUID[], -- specific users who can approve
  assigned_role TEXT CHECK (assigned_role IN ('owner', 'admin', 'member')), -- anyone with this role
  -- Requirements
  required_approvals INTEGER NOT NULL DEFAULT 1, -- how many approvals needed for this step
  current_approvals INTEGER NOT NULL DEFAULT 0,
  -- Timing
  timeout_minutes INTEGER, -- auto-escalate or expire if no decision within this time
  activated_at TIMESTAMPTZ, -- when this step became active
  completed_at TIMESTAMPTZ, -- when this step was approved/rejected
  -- Decision
  decided_by UUID REFERENCES auth.users(id),
  decision_comment TEXT,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(request_id, step_order)
);

-- Votes per step (extends the existing approval_votes concept)
CREATE TABLE step_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES approval_steps(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  vote TEXT NOT NULL CHECK (vote IN ('approve', 'reject')),
  comment TEXT,
  source TEXT DEFAULT 'dashboard',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(step_id, user_id) -- one vote per user per step
);

-- Add multi-step flag to approval_requests
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS has_steps BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0;
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 0;

-- RLS policies
ALTER TABLE approval_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE step_votes ENABLE ROW LEVEL SECURITY;

-- Org members can view steps for approvals in their org
CREATE POLICY "Org members can view approval steps" ON approval_steps
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM approval_requests
      WHERE org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
    )
  );

-- Org members can view step votes
CREATE POLICY "Org members can view step votes" ON step_votes
  FOR SELECT USING (
    request_id IN (
      SELECT id FROM approval_requests
      WHERE org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX idx_approval_steps_request ON approval_steps(request_id, step_order);
CREATE INDEX idx_approval_steps_status ON approval_steps(status) WHERE status = 'active';
CREATE INDEX idx_approval_steps_team ON approval_steps(assigned_team_id) WHERE assigned_team_id IS NOT NULL;
CREATE INDEX idx_step_votes_step ON step_votes(step_id);
CREATE INDEX idx_step_votes_request ON step_votes(request_id);
