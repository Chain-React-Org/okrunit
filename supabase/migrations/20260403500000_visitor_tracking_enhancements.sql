-- Enhanced visitor tracking: duration, pages, device info
ALTER TABLE visitor_tracking
  ADD COLUMN duration_seconds INTEGER,
  ADD COLUMN pages_viewed INTEGER DEFAULT 1,
  ADD COLUMN device_type TEXT,
  ADD COLUMN browser TEXT,
  ADD COLUMN country TEXT;
