-- Track whether an org has ever had a paid subscription.
-- Used to gate the 40% new-customer discount (first 3 months only).
ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS has_had_paid_subscription BOOLEAN NOT NULL DEFAULT false;

-- Backfill: any org that currently has (or had) a non-free plan counts as having had a paid sub.
UPDATE subscriptions
SET has_had_paid_subscription = true
WHERE plan_id != 'free'
   OR stripe_subscription_id IS NOT NULL;
