-- ---------------------------------------------------------------------------
-- OKrunit -- Optional webhook-bridge for tweet posting
-- ---------------------------------------------------------------------------
-- When post_webhook_url is set, the cron POSTs the approved tweet to that
-- URL instead of calling the X API directly. The receiver (Make.com, Zapier,
-- IFTTT, custom service) is responsible for actually posting to X. Lets
-- founders avoid X API tier costs by bridging through a service that has
-- already paid for X integration access.
-- ---------------------------------------------------------------------------

ALTER TABLE tweet_config
  ADD COLUMN post_webhook_url TEXT;
