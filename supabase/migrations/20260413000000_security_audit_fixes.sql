-- Security audit fixes: RLS enablement, policy corrections, indexes, webauthn update policy

-- =============================================================================
-- 1. Enable RLS on tables missing it
-- =============================================================================

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_retry_queue ENABLE ROW LEVEL SECURITY;

-- Service-role-only policies (no anon access)
CREATE POLICY "Service role only" ON newsletter_subscribers
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON visitor_tracking
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role only" ON webhook_retry_queue
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 2. Fix broken approval_conditions RLS policy
--    Old policy used current_setting('request.jwt.claims') which doesn't work
-- =============================================================================

DROP POLICY IF EXISTS "approval_conditions_org_access" ON approval_conditions;
DROP POLICY IF EXISTS "Users can manage conditions for their org requests" ON approval_conditions;

CREATE POLICY "Users can manage conditions for their org requests" ON approval_conditions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM approval_requests ar
      WHERE ar.id = approval_conditions.request_id
        AND ar.org_id = (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() LIMIT 1)
    )
  );

-- =============================================================================
-- 3. Fix RLS policies that don't check role (admins-only operations)
-- =============================================================================

-- Fix connections: require admin/owner role for INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Admins can create connections" ON connections;
CREATE POLICY "Admins can create connections" ON connections
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM org_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can update org connections" ON connections;
DROP POLICY IF EXISTS "Admins can update connections" ON connections;
CREATE POLICY "Admins can update connections" ON connections
  FOR UPDATE USING (
    org_id IN (
      SELECT om.org_id FROM org_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admins can delete org connections" ON connections;
DROP POLICY IF EXISTS "Admins can delete connections" ON connections;
CREATE POLICY "Admins can delete connections" ON connections
  FOR DELETE USING (
    org_id IN (
      SELECT om.org_id FROM org_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- Fix org_invites: require admin/owner role
DROP POLICY IF EXISTS "Admins can create invites" ON org_invites;
CREATE POLICY "Admins can create invites" ON org_invites
  FOR INSERT WITH CHECK (
    org_id IN (
      SELECT om.org_id FROM org_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- Fix approval_rules: require admin/owner role for write operations
-- Drop existing per-operation policies, replace with single ALL policy
DROP POLICY IF EXISTS "Admins can create rules" ON approval_rules;
DROP POLICY IF EXISTS "Admins can update rules" ON approval_rules;
DROP POLICY IF EXISTS "Admins can delete rules" ON approval_rules;
DROP POLICY IF EXISTS "Admins can manage rules" ON approval_rules;
CREATE POLICY "Admins can manage rules" ON approval_rules
  FOR ALL USING (
    org_id IN (
      SELECT om.org_id FROM org_memberships om
      WHERE om.user_id = auth.uid() AND om.role IN ('owner', 'admin')
    )
  );

-- =============================================================================
-- 4. Add missing database indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_org_memberships_org_role ON org_memberships (org_id, role);
CREATE INDEX IF NOT EXISTS idx_messaging_connections_org_active ON messaging_connections (org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_webhook_retry_queue_request ON webhook_retry_queue (request_id);
CREATE INDEX IF NOT EXISTS idx_in_app_notifications_org ON in_app_notifications (org_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_flow ON approval_requests (flow_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_org_created ON approval_requests (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_delivery_log_success ON webhook_delivery_log (success);

-- Partial indexes for cron job queries
CREATE INDEX IF NOT EXISTS idx_approval_requests_sla_pending ON approval_requests (sla_deadline)
  WHERE status = 'pending' AND sla_breached = false AND sla_warning_sent = false AND sla_deadline IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_approval_requests_escalation_pending ON approval_requests (next_escalation_at)
  WHERE status = 'pending' AND next_escalation_at IS NOT NULL;

-- =============================================================================
-- 5. Add missing UPDATE policy for webauthn_credentials
-- =============================================================================

DROP POLICY IF EXISTS "Users can update own webauthn credentials" ON webauthn_credentials;
CREATE POLICY "Users can update own webauthn credentials" ON webauthn_credentials
  FOR UPDATE USING (user_id = auth.uid());
