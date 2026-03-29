import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-[160px]" />
      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border-0 p-5 shadow-[var(--shadow-card)]">
            <Skeleton className="h-3 w-[80px] mb-2" />
            <Skeleton className="h-8 w-[50px]" />
          </div>
        ))}
      </div>
      {/* Recent activity */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-[140px]" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-[240px]" />
              <Skeleton className="h-3 w-[120px]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
