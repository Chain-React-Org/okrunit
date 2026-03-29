import { Skeleton } from "@/components/ui/skeleton";

export default function AnalyticsLoading() {
  return (
    <div>
      {/* Stats cards skeleton */}
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

      {/* Charts placeholder */}
      <div className="mt-8 space-y-6">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[200px] rounded-xl" />
          <Skeleton className="h-[200px] rounded-xl" />
        </div>
      </div>
    </div>
  );
}
