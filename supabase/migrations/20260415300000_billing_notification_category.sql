-- Add billing category for subscription and payment notifications
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'billing';
