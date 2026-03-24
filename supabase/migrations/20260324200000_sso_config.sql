-- ============================================================================
-- SSO/SAML Configuration
-- ============================================================================

CREATE TABLE sso_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'saml',
  entity_id TEXT NOT NULL,
  sso_url TEXT NOT NULL,
  certificate TEXT NOT NULL,
  attribute_mapping JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One SSO config per org
  CONSTRAINT sso_configs_org_id_unique UNIQUE (org_id)
);

-- Index for fast lookups
CREATE INDEX idx_sso_configs_org_id ON sso_configs(org_id);

-- RLS
ALTER TABLE sso_configs ENABLE ROW LEVEL SECURITY;

-- Org members can read their org's SSO config
CREATE POLICY "sso_configs_select_org_members" ON sso_configs
  FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM org_memberships WHERE user_id = auth.uid()
    )
  );

-- Only org owners/admins can insert/update/delete SSO configs
CREATE POLICY "sso_configs_insert_org_admins" ON sso_configs
  FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM org_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "sso_configs_update_org_admins" ON sso_configs
  FOR UPDATE
  USING (
    org_id IN (
      SELECT org_id FROM org_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "sso_configs_delete_org_admins" ON sso_configs
  FOR DELETE
  USING (
    org_id IN (
      SELECT org_id FROM org_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Updated_at trigger
CREATE TRIGGER sso_configs_updated_at
  BEFORE UPDATE ON sso_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
