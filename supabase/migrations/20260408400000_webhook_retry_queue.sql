-- Durable webhook retry queue for failed callback deliveries
CREATE TABLE IF NOT EXISTS webhook_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES connections(id) ON DELETE SET NULL,
  callback_url text NOT NULL,
  callback_headers jsonb DEFAULT '{}',
  payload jsonb NOT NULL,
  attempt_count integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 8,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'delivered', 'failed_permanent'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_retry_queue_pending ON webhook_retry_queue(next_attempt_at) WHERE status = 'pending';
CREATE INDEX idx_retry_queue_connection ON webhook_retry_queue(connection_id, status);

-- Track consecutive failures on connections for auto-pause
ALTER TABLE connections ADD COLUMN IF NOT EXISTS consecutive_webhook_failures integer NOT NULL DEFAULT 0;
ALTER TABLE connections ADD COLUMN IF NOT EXISTS webhook_paused_at timestamptz;
