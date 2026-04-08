-- Approval templates for reusable request configurations
CREATE TABLE IF NOT EXISTS approval_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  title_pattern text, -- e.g., "Deploy {service} to {environment}"
  action_type text,
  default_priority text DEFAULT 'medium',
  assigned_approvers uuid[] DEFAULT '{}',
  conditions jsonb DEFAULT '{}',
  metadata_schema jsonb DEFAULT '{}', -- defines required/optional metadata fields
  callback_url_pattern text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_templates_org ON approval_templates(org_id, is_active);

ALTER TABLE approval_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view templates"
  ON approval_templates FOR SELECT
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Org admins can manage templates"
  ON approval_templates FOR ALL
  USING (org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid() AND role IN ('owner', 'admin')));

-- Add template_id reference to approval_requests
ALTER TABLE approval_requests ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES approval_templates(id) ON DELETE SET NULL;
