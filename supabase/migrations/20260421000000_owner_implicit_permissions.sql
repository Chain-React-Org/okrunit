-- Owners implicitly have approve + connect permissions
--
-- Org owners should always be able to approve requests and create connections.
-- Prior rows created with can_approve=false / can_connect=false leave the org
-- with an owner who cannot take approval actions, which is never intended.

-- 1. Backfill existing owner rows.
UPDATE org_memberships
SET can_approve = true,
    can_connect = true
WHERE role = 'owner'
  AND (can_approve = false OR can_connect = false);

-- 2. Trigger so future inserts/updates can never store an owner without these flags.
CREATE OR REPLACE FUNCTION enforce_owner_permissions()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'owner' THEN
    NEW.can_approve := true;
    NEW.can_connect := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_owner_permissions_trigger ON org_memberships;
CREATE TRIGGER enforce_owner_permissions_trigger
  BEFORE INSERT OR UPDATE ON org_memberships
  FOR EACH ROW
  EXECUTE FUNCTION enforce_owner_permissions();
