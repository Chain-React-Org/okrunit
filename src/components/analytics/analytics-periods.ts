export const PERIOD_OPTIONS = [
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "60", label: "Last 60 days", days: 60 },
  { value: "90", label: "Last 90 days", days: 90 },
  { value: "180", label: "Last 180 days", days: 180 },
  { value: "365", label: "Last 365 days", days: 365 },
] as const;

export const VALID_DAYS = new Set<number>(PERIOD_OPTIONS.map((o) => o.days));
