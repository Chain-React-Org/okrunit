-- ---------------------------------------------------------------------------
-- Add "approver" role: owner > admin > approver > member
-- Approvers can approve/reject requests but cannot manage teams, connections,
-- rules, settings, or invites.
-- ---------------------------------------------------------------------------

-- 1. org_memberships.role — drop and recreate CHECK constraint
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE rel.relname = 'org_memberships'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%role%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE org_memberships DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE org_memberships
  ADD CONSTRAINT org_memberships_role_check
  CHECK (role IN ('owner', 'admin', 'approver', 'member'));

-- 2. org_invites.role
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE rel.relname = 'org_invites'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%role%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE org_invites DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE org_invites
  ADD CONSTRAINT org_invites_role_check
  CHECK (role IN ('admin', 'approver', 'member'));

-- 3. approval_steps.assigned_role
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE rel.relname = 'approval_steps'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%assigned_role%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE approval_steps DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE approval_steps
  ADD CONSTRAINT approval_steps_assigned_role_check
  CHECK (assigned_role IN ('owner', 'admin', 'approver', 'member'));

-- 4. approval_requests.required_role
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE rel.relname = 'approval_requests'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%required_role%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE approval_requests DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE approval_requests
  ADD CONSTRAINT approval_requests_required_role_check
  CHECK (required_role IS NULL OR required_role IN ('owner', 'admin', 'approver', 'member'));

-- 5. approval_flows.required_role
DO $$
DECLARE
  cname TEXT;
BEGIN
  SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
   WHERE rel.relname = 'approval_flows'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%required_role%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE approval_flows DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE approval_flows
  ADD CONSTRAINT approval_flows_required_role_check
  CHECK (required_role IS NULL OR required_role IN ('owner', 'admin', 'approver', 'member'));

-- 6. Trigger: approvers always have can_approve = true
CREATE OR REPLACE FUNCTION enforce_approver_can_approve()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'approver' THEN
    NEW.can_approve := true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_approver_can_approve_trigger
  BEFORE INSERT OR UPDATE ON org_memberships
  FOR EACH ROW EXECUTE FUNCTION enforce_approver_can_approve();
