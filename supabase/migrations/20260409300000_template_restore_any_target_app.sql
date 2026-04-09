-- Restore "any" as a valid target_app for templates used via the raw API.
-- Integration dropdowns (n8n, Zapier, Make) filter by exact match, so "any"
-- templates will only appear in the dashboard, not in integration dropdowns.

ALTER TABLE approval_templates DROP CONSTRAINT IF EXISTS chk_target_app;
ALTER TABLE approval_templates
  ADD CONSTRAINT chk_target_app
  CHECK (target_app IN ('any', 'n8n', 'zapier', 'make'));

ALTER TABLE approval_templates ALTER COLUMN target_app SET DEFAULT 'any';
