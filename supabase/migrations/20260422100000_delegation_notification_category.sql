-- Add delegation_received category so we can ping delegates in-app whenever
-- a teammate hands off approval authority to them.

ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'delegation_received';
