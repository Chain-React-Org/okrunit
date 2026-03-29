import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="space-y-8">
      {/* Export button */}
      <div className="flex items-center justify-end">
        <Skeleton className="h-9 w-[110px] rounded-md" />
      </div>

      {/* Stat cards — 4 columns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border-0 p-5 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-3 w-[90px]" />
                <Skeleton className="h-8 w-[60px]" />
              </div>
              <Skeleton className="size-10 rounded-lg" />
            </div>
            <Skeleton className="mt-3 h-3 w-[110px]" />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Volume chart — full width */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-border/50 bg-[var(--card)] p-6">
            <Skeleton className="h-4 w-[120px] mb-4" />
            <Skeleton className="h-[200px] w-full rounded-lg" />
          </div>
        </div>
        {/* Approval rate chart */}
        <div className="rounded-xl border border-border/50 bg-[var(--card)] p-6">
          <Skeleton className="h-4 w-[130px] mb-4" />
          <Skeleton className="h-[180px] w-full rounded-lg" />
        </div>
        {/* Response time chart */}
        <div className="rounded-xl border border-border/50 bg-[var(--card)] p-6">
          <Skeleton className="h-4 w-[140px] mb-4" />
          <Skeleton className="h-[180px] w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
