-- Calendar connections for auto-delegation
CREATE TABLE IF NOT EXISTS calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider text NOT NULL, -- 'google' or 'microsoft'
  access_token text NOT NULL,
  refresh_token text,
  token_expires_at timestamptz,
  calendar_email text,
  is_active boolean NOT NULL DEFAULT true,
  auto_delegate_to uuid REFERENCES auth.users(id), -- who to delegate to when OOO
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, org_id, provider)
);

CREATE INDEX idx_calendar_connections_active ON calendar_connections(is_active) WHERE is_active = true;

ALTER TABLE calendar_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own calendar connections"
  ON calendar_connections FOR ALL
  USING (user_id = auth.uid());
