-- ============================================================
-- DATA CLEANUP SCRIPT
-- Removes all test data while keeping the admin account,
-- org, subscription, and a default team so app pages work.
-- Run against BOTH dev and production databases.
-- ============================================================

BEGIN;

-- Step 0: Verify admin user exists before we delete anything
DO $$
DECLARE
  admin_uid UUID;
  admin_org UUID;
BEGIN
  SELECT id INTO admin_uid FROM auth.users WHERE email = 'nathaniel.stoddard@chainreact.app';
  IF admin_uid IS NULL THEN
    RAISE EXCEPTION 'Admin user not found! Aborting.';
  END IF;
  SELECT org_id INTO admin_org FROM org_memberships WHERE user_id = admin_uid AND is_default = true LIMIT 1;
  IF admin_org IS NULL THEN
    RAISE EXCEPTION 'Admin org not found! Aborting.';
  END IF;
  RAISE NOTICE 'Admin user: %, org: %', admin_uid, admin_org;
END $$;

-- ============================================================
-- Step 1: Truncate all transactional/test data
-- These are safe to empty completely. Pages handle empty state.
-- ============================================================

-- Approval data (all requests, even admin's)
TRUNCATE approval_attachments CASCADE;
TRUNCATE step_votes CASCADE;
TRUNCATE approval_steps CASCADE;
TRUNCATE approval_votes CASCADE;
TRUNCATE approval_comments CASCADE;
TRUNCATE approval_requests CASCADE;

-- Approval config (flows, rules, templates)
TRUNCATE approval_conditions CASCADE;
TRUNCATE bulk_approval_rules CASCADE;
TRUNCATE approval_rules CASCADE;
TRUNCATE approval_flows CASCADE;
TRUNCATE approval_templates CASCADE;
TRUNCATE approval_trust_counters CASCADE;
TRUNCATE approval_delegations CASCADE;

-- Connections and integrations
TRUNCATE connections CASCADE;
TRUNCATE oauth_access_tokens CASCADE;
TRUNCATE oauth_refresh_tokens CASCADE;
TRUNCATE oauth_authorization_codes CASCADE;
TRUNCATE oauth_clients CASCADE;
TRUNCATE messaging_connections CASCADE;
TRUNCATE telegram_link_nonces CASCADE;
TRUNCATE calendar_connections CASCADE;
TRUNCATE github_installations CASCADE;
TRUNCATE webhook_notification_channels CASCADE;

-- Webhooks and delivery
TRUNCATE webhook_delivery_log CASCADE;
TRUNCATE webhook_retry_queue CASCADE;
TRUNCATE webhook_test_requests CASCADE;
TRUNCATE webhook_test_endpoints CASCADE;

-- Notifications
TRUNCATE notification_delivery_log CASCADE;
TRUNCATE in_app_notifications CASCADE;
TRUNCATE request_watchers CASCADE;
TRUNCATE push_subscriptions CASCADE;
TRUNCATE notification_settings CASCADE;

-- Tokens
TRUNCATE email_action_tokens CASCADE;
TRUNCATE account_deletion_tokens CASCADE;

-- Audit and monitoring
TRUNCATE audit_log CASCADE;
TRUNCATE error_events CASCADE;
TRUNCATE error_issues CASCADE;

-- Usage and billing data (plans table and subscription row kept)
TRUNCATE usage_metrics CASCADE;
TRUNCATE invoices CASCADE;

-- Misc
TRUNCATE org_invites CASCADE;
TRUNCATE saved_filters CASCADE;
TRUNCATE sso_configs CASCADE;
TRUNCATE webauthn_credentials CASCADE;
TRUNCATE custom_roles CASCADE;
TRUNCATE visitor_tracking CASCADE;
TRUNCATE newsletter_subscribers CASCADE;

-- ============================================================
-- Step 2: Clean up teams, keeping admin's default team
-- ============================================================

-- Remove all team memberships and positions
TRUNCATE team_positions CASCADE;
TRUNCATE team_memberships CASCADE;

-- Delete teams belonging to other orgs
DELETE FROM teams
WHERE org_id NOT IN (
  SELECT org_id FROM org_memberships
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nathaniel.stoddard@chainreact.app')
);

-- Keep one team for admin's org (delete extras if any)
DELETE FROM teams
WHERE id NOT IN (
  SELECT id FROM teams
  WHERE org_id IN (
    SELECT org_id FROM org_memberships
    WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nathaniel.stoddard@chainreact.app')
  )
  ORDER BY created_at ASC
  LIMIT 1
);

-- Re-add admin as team member of their remaining team
INSERT INTO team_memberships (team_id, user_id)
SELECT t.id, u.id
FROM teams t
CROSS JOIN auth.users u
WHERE u.email = 'nathaniel.stoddard@chainreact.app'
ON CONFLICT DO NOTHING;

-- ============================================================
-- Step 3: Delete other users and orgs
-- ============================================================

-- Remove other org memberships
DELETE FROM org_memberships
WHERE user_id != (SELECT id FROM auth.users WHERE email = 'nathaniel.stoddard@chainreact.app');

-- Remove subscriptions for other orgs
DELETE FROM subscriptions
WHERE org_id NOT IN (
  SELECT org_id FROM org_memberships
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nathaniel.stoddard@chainreact.app')
);

-- Remove other organizations
DELETE FROM organizations
WHERE id NOT IN (
  SELECT org_id FROM org_memberships
  WHERE user_id = (SELECT id FROM auth.users WHERE email = 'nathaniel.stoddard@chainreact.app')
);

-- Delete other auth users (cascades to user_profiles)
DELETE FROM auth.users WHERE email != 'nathaniel.stoddard@chainreact.app';

-- ============================================================
-- Step 4: Verify results
-- ============================================================

SELECT 'auth.users' AS what, COUNT(*) AS rows FROM auth.users
UNION ALL SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL SELECT 'organizations', COUNT(*) FROM organizations
UNION ALL SELECT 'org_memberships', COUNT(*) FROM org_memberships
UNION ALL SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL SELECT 'teams', COUNT(*) FROM teams
UNION ALL SELECT 'team_memberships', COUNT(*) FROM team_memberships
UNION ALL SELECT 'plans', COUNT(*) FROM plans
UNION ALL SELECT 'approval_requests', COUNT(*) FROM approval_requests
UNION ALL SELECT 'connections', Count(*) FROM connections
UNION ALL SELECT 'audit_log', COUNT(*) FROM audit_log;

COMMIT;
