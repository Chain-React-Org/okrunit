-- ============================================================================
-- Billing & Subscription System
-- ============================================================================

-- Plan definitions (static reference table)
CREATE TABLE plans (
  id TEXT PRIMARY KEY, -- 'free', 'pro', 'business', 'enterprise'
  name TEXT NOT NULL,
  description TEXT,
  price_monthly_cents INTEGER NOT NULL DEFAULT 0,
  price_yearly_cents INTEGER NOT NULL DEFAULT 0, -- annual price (if offered)
  stripe_price_id_monthly TEXT, -- Stripe Price ID for monthly billing
  stripe_price_id_yearly TEXT,  -- Stripe Price ID for yearly billing
  -- Limits
  max_requests_per_month INTEGER NOT NULL DEFAULT 100,
  max_connections INTEGER NOT NULL DEFAULT 2,
  max_team_members INTEGER NOT NULL DEFAULT 3,
  history_retention_days INTEGER NOT NULL DEFAULT 7,
  -- Feature flags
  features JSONB NOT NULL DEFAULT '[]', -- array of feature keys
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed plan data
INSERT INTO plans (id, name, description, price_monthly_cents, price_yearly_cents, stripe_price_id_monthly, stripe_price_id_yearly, max_requests_per_month, max_connections, max_team_members, history_retention_days, features, sort_order) VALUES
  ('free', 'Free', 'For individuals and small projects', 0, 0, NULL, NULL, 100, 2, 3, 7,
   '["email_notifications"]', 0),
  ('pro', 'Pro', 'For growing teams', 2000, 19200, 'price_1TEd8XFSXJNt9c6KUcAgC5mi', 'price_1TEd8XFSXJNt9c6KZ71PHrcP', -1, 15, 15, 90,
   '["email_notifications", "slack_notifications", "webhook_notifications", "rules_engine", "analytics"]', 1),
  ('business', 'Business', 'For scaling organizations', 6000, 57600, 'price_1TEd9PFSXJNt9c6Ko8EwWTQu', 'price_1TEd9QFSXJNt9c6K57sl8Xrs', -1, -1, -1, 365,
   '["email_notifications", "slack_notifications", "webhook_notifications", "rules_engine", "analytics", "analytics_export", "sso_saml", "audit_log_export", "multi_step_approvals", "custom_routing"]', 2),
  ('enterprise', 'Enterprise', 'For large organizations with custom needs', 0, 0, NULL, NULL, -1, -1, -1, -1,
   '["email_notifications", "slack_notifications", "webhook_notifications", "rules_engine", "analytics", "analytics_export", "sso_saml", "audit_log_export", "multi_step_approvals", "custom_routing", "dedicated_support", "on_prem", "custom_sla"]', 3);
-- Note: -1 means unlimited, enterprise price is custom/negotiated

-- Organization subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id) DEFAULT 'free',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'past_due', 'cancelled', 'trialing', 'expired')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'yearly', 'custom')),
  -- Stripe references
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id)
);

-- Monthly usage tracking (reset each billing period)
CREATE TABLE usage_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  requests_count INTEGER NOT NULL DEFAULT 0,
  connections_count INTEGER NOT NULL DEFAULT 0,
  team_members_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(org_id, period_start)
);

-- Payment history / invoices (synced from Stripe)
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  hosted_invoice_url TEXT, -- Stripe-hosted invoice page
  pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add plan_id to organizations for quick access (denormalized)
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS plan_id TEXT REFERENCES plans(id) DEFAULT 'free';

-- Create a subscription for every existing org (all start on free)
INSERT INTO subscriptions (org_id, plan_id, status, current_period_start, current_period_end)
SELECT id, 'free', 'active', date_trunc('month', now()), date_trunc('month', now()) + interval '1 month'
FROM organizations
ON CONFLICT (org_id) DO NOTHING;

-- RLS policies
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Plans are readable by everyone (public reference data)
CREATE POLICY "Plans are publicly readable" ON plans FOR SELECT USING (true);

-- Subscriptions: org members can read, only service role can write
CREATE POLICY "Org members can view their subscription" ON subscriptions
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
  );

-- Usage metrics: org members can read
CREATE POLICY "Org members can view usage" ON usage_metrics
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
  );

-- Invoices: org members can read
CREATE POLICY "Org members can view invoices" ON invoices
  FOR SELECT USING (
    org_id IN (SELECT org_id FROM org_memberships WHERE user_id = auth.uid())
  );

-- Indexes
CREATE INDEX idx_subscriptions_org_id ON subscriptions(org_id);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_sub ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_usage_metrics_org_period ON usage_metrics(org_id, period_start);
CREATE INDEX idx_invoices_org_id ON invoices(org_id);
CREATE INDEX idx_invoices_stripe_id ON invoices(stripe_invoice_id);
