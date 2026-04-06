-- Add approval_comment category to notification_category enum
ALTER TYPE notification_category ADD VALUE IF NOT EXISTS 'approval_comment';
