import { createAdminClient } from "@/lib/supabase/admin";

interface VisitorRow {
  id: string;
  visitor_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  referrer: string | null;
  landing_page: string | null;
  user_id: string | null;
  visited_at: string;
  signed_up_at: string | null;
  duration_seconds: number | null;
  device_type: string | null;
  browser: string | null;
}

export interface SourceStat {
  source: string;
  visits: number;
  signups: number;
  conversionRate: number;
}

export interface DailyVisit {
  date: string;
  count: number;
}

export interface DeviceStat {
  name: string;
  count: number;
  percentage: number;
}

export interface TrafficData {
  totalVisits: number;
  uniqueVisitors: number;
  totalSignups: number;
  conversionRate: number;
  avgDuration: number;
  bounceRate: number;
  bySource: SourceStat[];
  byCampaign: SourceStat[];
  byMedium: SourceStat[];
  dailyVisits: DailyVisit[];
  byDevice: DeviceStat[];
  byBrowser: DeviceStat[];
  topLandingPages: { page: string; visits: number; avgDuration: number }[];
}

export async function getTrafficData(): Promise<TrafficData> {
  const admin = createAdminClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString();

  const { data: rows } = await admin
    .from("visitor_tracking")
    .select("*")
    .gte("visited_at", thirtyDaysAgo)
    .order("visited_at", { ascending: true })
    .returns<VisitorRow[]>();

  const visits = rows ?? [];

  const uniqueVisitors = new Set(visits.map((v) => v.visitor_id)).size;
  const signups = visits.filter((v) => v.user_id).length;

  // Duration stats
  const withDuration = visits.filter((v) => v.duration_seconds !== null);
  const avgDuration = withDuration.length > 0
    ? Math.round(withDuration.reduce((sum, v) => sum + (v.duration_seconds ?? 0), 0) / withDuration.length)
    : 0;

  // Bounce rate: visits with duration < 10 seconds (or no duration recorded)
  const bounces = visits.filter((v) => v.duration_seconds === null || v.duration_seconds < 10).length;
  const bounceRate = visits.length > 0 ? Math.round((bounces / visits.length) * 100) : 0;

  // Group by source/campaign/medium
  const bySource = aggregate(visits, (v) => v.utm_source);
  const byCampaign = aggregate(visits, (v) => v.utm_campaign);
  const byMedium = aggregate(visits, (v) => v.utm_medium);

  // Daily visits
  const dailyMap = new Map<string, number>();
  for (const v of visits) {
    const date = v.visited_at.slice(0, 10);
    dailyMap.set(date, (dailyMap.get(date) ?? 0) + 1);
  }
  const dailyVisits = Array.from(dailyMap, ([date, count]) => ({ date, count }));

  // Device breakdown
  const byDevice = countGroup(visits, (v) => v.device_type ?? "unknown");
  const byBrowser = countGroup(visits, (v) => v.browser ?? "unknown");

  // Top landing pages with avg duration
  const pageMap = new Map<string, { visits: number; totalDuration: number; durationCount: number }>();
  for (const v of visits) {
    const page = v.landing_page ?? "/";
    const entry = pageMap.get(page) ?? { visits: 0, totalDuration: 0, durationCount: 0 };
    entry.visits++;
    if (v.duration_seconds !== null) {
      entry.totalDuration += v.duration_seconds;
      entry.durationCount++;
    }
    pageMap.set(page, entry);
  }
  const topLandingPages = Array.from(pageMap, ([page, stats]) => ({
    page,
    visits: stats.visits,
    avgDuration: stats.durationCount > 0 ? Math.round(stats.totalDuration / stats.durationCount) : 0,
  }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 10);

  return {
    totalVisits: visits.length,
    uniqueVisitors,
    totalSignups: signups,
    conversionRate: uniqueVisitors > 0 ? Math.round((signups / uniqueVisitors) * 100) : 0,
    avgDuration,
    bounceRate,
    bySource,
    byCampaign,
    byMedium,
    dailyVisits,
    byDevice,
    byBrowser,
    topLandingPages,
  };
}

function aggregate(
  visits: VisitorRow[],
  keyFn: (v: VisitorRow) => string | null,
): SourceStat[] {
  const map = new Map<string, { visits: number; signups: number }>();
  for (const v of visits) {
    const key = keyFn(v);
    if (!key) continue;
    const entry = map.get(key) ?? { visits: 0, signups: 0 };
    entry.visits++;
    if (v.user_id) entry.signups++;
    map.set(key, entry);
  }
  return Array.from(map, ([source, stats]) => ({
    source,
    visits: stats.visits,
    signups: stats.signups,
    conversionRate: stats.visits > 0 ? Math.round((stats.signups / stats.visits) * 100) : 0,
  })).sort((a, b) => b.visits - a.visits);
}

function countGroup(
  visits: VisitorRow[],
  keyFn: (v: VisitorRow) => string,
): DeviceStat[] {
  const map = new Map<string, number>();
  for (const v of visits) {
    const key = keyFn(v);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const total = visits.length || 1;
  return Array.from(map, ([name, count]) => ({
    name,
    count,
    percentage: Math.round((count / total) * 100),
  })).sort((a, b) => b.count - a.count);
}
