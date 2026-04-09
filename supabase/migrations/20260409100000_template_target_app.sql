-- Add target_app column to approval_templates so templates can be scoped to a
-- specific integration (n8n, Zapier, Make) or left as "any" (the default).
-- This lets the UI show only the fields that the chosen app supports and lets
-- each integration's template dropdown filter to compatible templates.

ALTER TABLE approval_templates
  ADD COLUMN IF NOT EXISTS target_app text NOT NULL DEFAULT 'any';

-- Lightweight check constraint to prevent typos.
ALTER TABLE approval_templates
  ADD CONSTRAINT chk_target_app
  CHECK (target_app IN ('any', 'n8n', 'zapier', 'make'));

-- Index for filtering templates by app in the integration dropdowns.
CREATE INDEX IF NOT EXISTS idx_templates_target_app
  ON approval_templates(org_id, target_app, is_active);
