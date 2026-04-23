-- ---------------------------------------------------------------------------
-- Security: pin search_path on every public function
-- ---------------------------------------------------------------------------
-- Supabase's Security Advisor flags functions with a mutable search_path
-- as "Function Search Path Mutable". On a SECURITY DEFINER function that
-- matters: an attacker who can create objects in a schema earlier in
-- the resolved search_path can hijack what the function resolves (e.g.
-- a fake `auth.uid()` in a `public2` schema ahead of `auth`). Even on
-- SECURITY INVOKER functions, pinning the search_path is the documented
-- best practice.
--
-- We use `SET search_path = public, pg_catalog` so every function:
--   1. Still resolves public tables/types without bare-schema references
--      breaking (most function bodies reference objects without a
--      `public.` prefix),
--   2. Has system catalogs available, and
--   3. Does NOT fall through to any user-controlled schema.
--
-- `ALTER FUNCTION ... SET search_path = ...` doesn't require touching
-- the function body, so this is a pure metadata change. Safe to re-run.
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER functions — highest priority
ALTER FUNCTION public.auth_org_id()                                                 SET search_path = public, pg_catalog;
ALTER FUNCTION public.auth_user_id()                                                SET search_path = public, pg_catalog;
ALTER FUNCTION public.delete_organization(target_org_id uuid)                       SET search_path = public, pg_catalog;
ALTER FUNCTION public.transfer_org_ownership(p_org_id uuid, p_old_owner_id uuid, p_new_owner_id uuid) SET search_path = public, pg_catalog;

-- SECURITY INVOKER triggers / helpers
ALTER FUNCTION public.enforce_admin_can_connect()                                   SET search_path = public, pg_catalog;
ALTER FUNCTION public.enforce_approver_can_approve()                                SET search_path = public, pg_catalog;
ALTER FUNCTION public.enforce_owner_permissions()                                   SET search_path = public, pg_catalog;
ALTER FUNCTION public.prevent_audit_log_mutation()                                  SET search_path = public, pg_catalog;
ALTER FUNCTION public.sync_error_issue_counts()                                     SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_updated_at_column()                                    SET search_path = public, pg_catalog;
