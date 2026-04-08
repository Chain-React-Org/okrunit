-- ---------------------------------------------------------------------------
-- SMS & Webhook Notification Channels
-- ---------------------------------------------------------------------------

-- Add phone number to user profiles for SMS notifications
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone_number text;

-- Add sms_enabled to notification_settings
ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS sms_enabled boolean NOT NULL DEFAULT false;

-- Webhook notification channel configuration
CREATE TABLE IF NOT EXISTS webhook_notification_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  url text NOT NULL,
  http_method text NOT NULL DEFAULT 'POST',
  headers jsonb DEFAULT '{}',
  payload_template jsonb,
  events text[] NOT NULL DEFAULT '{request.created}',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_channels_org ON webhook_notification_channels(org_id, is_active);

ALTER TABLE webhook_notification_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view webhook channels"
  ON webhook_notification_channels FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org admins can manage webhook channels"
  ON webhook_notification_channels FOR ALL
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));
