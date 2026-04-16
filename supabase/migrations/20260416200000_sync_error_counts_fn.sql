-- Function to sync error_issues.event_count with actual event rows.
-- Called by data-retention cron after deleting old events.
CREATE OR REPLACE FUNCTION sync_error_issue_counts()
RETURNS void AS $$
BEGIN
  UPDATE error_issues ei
  SET event_count = sub.cnt
  FROM (
    SELECT issue_id, COUNT(*)::int AS cnt
    FROM error_events
    GROUP BY issue_id
  ) sub
  WHERE ei.id = sub.issue_id
    AND ei.event_count != sub.cnt;

  -- Issues with zero events remaining
  UPDATE error_issues
  SET event_count = 0
  WHERE id NOT IN (SELECT DISTINCT issue_id FROM error_events)
    AND event_count != 0;
END;
$$ LANGUAGE plpgsql;
