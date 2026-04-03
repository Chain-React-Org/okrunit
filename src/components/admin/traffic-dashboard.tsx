"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import type { TrafficData, SourceStat, DeviceStat } from "@/lib/admin-traffic-data";

interface TrafficDashboardProps {
  data: TrafficData;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function SourceTable({ title, description, rows }: { title: string; description: string; rows: SourceStat[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Source</th>
                  <th className="pb-2 font-medium text-right">Visits</th>
                  <th className="pb-2 font-medium text-right">Signups</th>
                  <th className="pb-2 font-medium text-right">Conv. %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.source} className="border-b last:border-0">
                    <td className="py-2 font-medium">{row.source}</td>
                    <td className="py-2 text-right">{row.visits}</td>
                    <td className="py-2 text-right">{row.signups}</td>
                    <td className="py-2 text-right">{row.conversionRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DeviceTable({ title, rows }: { title: string; rows: DeviceStat[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={row.name} className="flex items-center justify-between text-sm">
                <span className="font-medium capitalize">{row.name}</span>
                <div className="flex items-center gap-3">
                  <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${row.percentage}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-muted-foreground">
                    {row.count} ({row.percentage}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UTMBuilder() {
  const [source, setSource] = useState("");
  const [medium, setMedium] = useState("");
  const [campaign, setCampaign] = useState("");
  const [copied, setCopied] = useState(false);

  const baseUrl = "https://okrunit.com";
  const params = new URLSearchParams();
  if (source) params.set("utm_source", source);
  if (medium) params.set("utm_medium", medium);
  if (campaign) params.set("utm_campaign", campaign);
  const generatedUrl = params.toString() ? `${baseUrl}?${params.toString()}` : baseUrl;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>UTM Link Builder</CardTitle>
        <CardDescription>Create tracked URLs for campaigns</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="utm-source">Source</Label>
            <Input
              id="utm-source"
              placeholder="e.g. facebook, reddit, newsletter"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="utm-medium">Medium</Label>
            <Input
              id="utm-medium"
              placeholder="e.g. social, paid, email"
              value={medium}
              onChange={(e) => setMedium(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="utm-campaign">Campaign</Label>
            <Input
              id="utm-campaign"
              placeholder="e.g. launch, summer-sale"
              value={campaign}
              onChange={(e) => setCampaign(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={generatedUrl}
            className="font-mono text-xs"
          />
          <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function TrafficDashboard({ data }: TrafficDashboardProps) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Traffic</h1>
        <p className="text-muted-foreground">Visitor analytics and UTM tracking (last 30 days)</p>
      </div>

      {/* Stats overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Visits" value={data.totalVisits} />
        <StatCard label="Unique Visitors" value={data.uniqueVisitors} />
        <StatCard label="Signups" value={data.totalSignups} />
        <StatCard label="Conversion Rate" value={`${data.conversionRate}%`} />
        <StatCard label="Avg. Time on Page" value={formatDuration(data.avgDuration)} />
        <StatCard label="Bounce Rate" value={`${data.bounceRate}%`} />
      </div>

      {/* Visits over time chart */}
      <Card>
        <CardHeader>
          <CardTitle>Visits Over Time</CardTitle>
          <CardDescription>Daily tracked visits over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          {data.dailyVisits.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              No visit data yet
            </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.dailyVisits} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground text-xs"
                    tickFormatter={(value: string) => {
                      const d = new Date(value);
                      return `${d.getMonth() + 1}/${d.getDate()}`;
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground text-xs" allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const value = payload[0].value as number;
                      return (
                        <div className="rounded-lg border bg-background px-3 py-2 shadow-md">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-sm text-muted-foreground">
                            {value} visit{value !== 1 ? "s" : ""}
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="count" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sources and campaigns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SourceTable title="Top Sources" description="Where visitors are coming from" rows={data.bySource} />
        <SourceTable title="Top Campaigns" description="Performance by utm_campaign" rows={data.byCampaign} />
      </div>

      <SourceTable title="By Medium" description="Performance by utm_medium" rows={data.byMedium} />

      {/* Landing pages */}
      <Card>
        <CardHeader>
          <CardTitle>Top Landing Pages</CardTitle>
          <CardDescription>Most visited pages with average time spent</CardDescription>
        </CardHeader>
        <CardContent>
          {data.topLandingPages.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">Page</th>
                    <th className="pb-2 font-medium text-right">Visits</th>
                    <th className="pb-2 font-medium text-right">Avg. Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topLandingPages.map((row) => (
                    <tr key={row.page} className="border-b last:border-0">
                      <td className="py-2 font-mono text-xs">{row.page}</td>
                      <td className="py-2 text-right">{row.visits}</td>
                      <td className="py-2 text-right">{formatDuration(row.avgDuration)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device and browser breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DeviceTable title="Devices" rows={data.byDevice} />
        <DeviceTable title="Browsers" rows={data.byBrowser} />
      </div>

      {/* UTM Builder */}
      <UTMBuilder />
    </div>
  );
}
