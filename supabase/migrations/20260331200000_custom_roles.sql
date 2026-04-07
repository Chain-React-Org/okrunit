-- ---------------------------------------------------------------------------
-- OKrunit -- Custom Roles
-- ---------------------------------------------------------------------------
-- Custom role definitions per organization. Each custom role maps to a
-- base permission level (member/approver/admin). The display name is
-- customizable but permissions follow the base level.
-- ---------------------------------------------------------------------------

CREATE TABLE custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  base_role TEXT NOT NULL CHECK (base_role IN ('member', 'approver', 'admin')),
  color TEXT DEFAULT '#6b7280',
  can_approve BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, name)
);

CREATE INDEX idx_custom_roles_org ON custom_roles(org_id);

-- Add custom_role_id to org_memberships (nullable, null means using built-in role)
ALTER TABLE org_memberships
  ADD COLUMN custom_role_id UUID REFERENCES custom_roles(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view custom roles" ON custom_roles
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage custom roles" ON custom_roles
  FOR ALL USING (
    org_id IN (
      SELECT org_id FROM org_memberships
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE TRIGGER set_custom_roles_updated_at
  BEFORE UPDATE ON custom_roles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
