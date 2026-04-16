-- Web Vitals performance monitoring table
CREATE TABLE IF NOT EXISTS web_vitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('good', 'needs-improvement', 'poor')),
  pathname TEXT,
  user_agent TEXT,
  connection_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_web_vitals_metric ON web_vitals(metric, created_at DESC);
CREATE INDEX idx_web_vitals_created_at ON web_vitals(created_at DESC);

-- RLS: only app admins can read, writes bypass via service role
ALTER TABLE web_vitals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App admins can read web vitals"
  ON web_vitals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.is_app_admin = true
    )
  );
