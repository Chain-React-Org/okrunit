-- Visitor / UTM tracking for referral analytics
CREATE TABLE visitor_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id TEXT NOT NULL,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer TEXT,
  landing_page TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  signed_up_at TIMESTAMPTZ
);

CREATE INDEX idx_visitor_tracking_visited_at ON visitor_tracking(visited_at);
CREATE INDEX idx_visitor_tracking_utm_source ON visitor_tracking(utm_source) WHERE utm_source IS NOT NULL;
CREATE INDEX idx_visitor_tracking_visitor_id ON visitor_tracking(visitor_id);
CREATE INDEX idx_visitor_tracking_user_id ON visitor_tracking(user_id) WHERE user_id IS NOT NULL;
