-- Function to delete an organization, handling the audit_log append-only trigger.
-- The trigger prevents CASCADE deletes on audit_log, so we temporarily disable it.
CREATE OR REPLACE FUNCTION delete_organization(target_org_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Temporarily disable the append-only trigger on audit_log
  ALTER TABLE audit_log DISABLE TRIGGER trg_audit_log_immutable;

  -- Delete the organization (CASCADE will now handle all dependent tables including audit_log)
  DELETE FROM organizations WHERE id = target_org_id;

  -- Re-enable the trigger
  ALTER TABLE audit_log ENABLE TRIGGER trg_audit_log_immutable;
END;
$$;
