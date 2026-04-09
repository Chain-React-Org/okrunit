-- Remove "any" as a valid target_app. Templates must target a specific app
-- so users do not accidentally set fields that get silently ignored.

-- Migrate existing "any" templates to "n8n" (the most feature-complete app).
UPDATE approval_templates SET target_app = 'n8n' WHERE target_app = 'any';

-- Replace the constraint to disallow "any".
ALTER TABLE approval_templates DROP CONSTRAINT IF EXISTS chk_target_app;
ALTER TABLE approval_templates
  ADD CONSTRAINT chk_target_app
  CHECK (target_app IN ('n8n', 'zapier', 'make'));

-- Update the column default.
ALTER TABLE approval_templates ALTER COLUMN target_app SET DEFAULT 'n8n';
