-- Atomic ownership transfer function.
-- Promotes the new owner and demotes the old owner in a single transaction.
CREATE OR REPLACE FUNCTION transfer_org_ownership(
  p_org_id uuid,
  p_old_owner_id uuid,
  p_new_owner_id uuid
) RETURNS void AS $$
BEGIN
  -- Promote the new owner
  UPDATE org_memberships
  SET role = 'owner'
  WHERE user_id = p_new_owner_id AND org_id = p_org_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'New owner is not a member of this organization';
  END IF;

  -- Demote the old owner to admin
  UPDATE org_memberships
  SET role = 'admin'
  WHERE user_id = p_old_owner_id AND org_id = p_org_id AND role = 'owner';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Current user is not the owner of this organization';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
