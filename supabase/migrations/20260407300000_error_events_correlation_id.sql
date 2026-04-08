-- ---------------------------------------------------------------------------
-- Add correlation_id column to error_events for request tracing
-- ---------------------------------------------------------------------------
-- Stores a per-request correlation ID generated via AsyncLocalStorage so
-- that logs and error events from the same request can be linked together.
-- ---------------------------------------------------------------------------

ALTER TABLE error_events
  ADD COLUMN correlation_id TEXT;

CREATE INDEX idx_error_events_correlation_id
  ON error_events(correlation_id)
  WHERE correlation_id IS NOT NULL;
