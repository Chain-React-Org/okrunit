-- Notification delivery log for debugging "I didn't get notified" issues
CREATE TABLE IF NOT EXISTS notification_delivery_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES approval_requests(id) ON DELETE SET NULL,
  recipient_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  channel text NOT NULL, -- 'email', 'slack', 'discord', 'teams', 'telegram', 'web_push', 'webhook'
  status text NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'suppressed'
  suppression_reason text, -- 'quiet_hours', 'priority_filter', 'channel_disabled', 'no_config'
  error_message text,
  external_id text, -- Slack message ID, email ID, etc.
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_ndl_org_id ON notification_delivery_log(org_id, created_at DESC);
CREATE INDEX idx_ndl_request_id ON notification_delivery_log(request_id);
CREATE INDEX idx_ndl_recipient ON notification_delivery_log(recipient_user_id, created_at DESC);
CREATE INDEX idx_ndl_status ON notification_delivery_log(org_id, status, created_at DESC);

-- Enable RLS
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- Policy: org members can read their org's delivery log
CREATE POLICY "Org members can view notification delivery log"
  ON notification_delivery_log FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));
