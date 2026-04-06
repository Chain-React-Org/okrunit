-- ---------------------------------------------------------------------------
-- SSO Enhancements: enforce_sso, certificate rotation, SLO support
-- ---------------------------------------------------------------------------

ALTER TABLE sso_configs
  ADD COLUMN IF NOT EXISTS enforce_sso BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certificate_secondary TEXT,
  ADD COLUMN IF NOT EXISTS slo_url TEXT;

COMMENT ON COLUMN sso_configs.enforce_sso IS 'When true, users with this SSO domain must use SSO (password login blocked)';
COMMENT ON COLUMN sso_configs.certificate_secondary IS 'Secondary signing certificate for IdP cert rotation. Both certs accepted during rollover.';
COMMENT ON COLUMN sso_configs.slo_url IS 'Single Logout endpoint URL from IdP';
