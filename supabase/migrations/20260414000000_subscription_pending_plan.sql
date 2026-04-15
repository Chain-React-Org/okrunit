-- Add pending_plan_id for deferred downgrades.
-- When a user downgrades, they keep their current plan features until
-- the billing period ends. This column tracks what plan to switch to
-- at renewal time.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS pending_plan_id TEXT REFERENCES plans(id);
