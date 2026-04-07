-- Add new notification categories for connection, role, and limit events
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'connection_deactivated';
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'role_changed';
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'limit_approaching';
