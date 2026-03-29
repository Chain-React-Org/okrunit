import { Skeleton } from "@/components/ui/skeleton";

export default function OverviewLoading() {
  return (
    <div className="space-y-8">
      {/* Org header */}
      <div>
        <Skeleton className="h-3 w-[80px] mb-1.5" />
        <Skeleton className="h-7 w-[200px]" />
      </div>

      {/* Stats row — 5 stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3.5"
          >
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="min-w-0">
              <Skeleton className="h-7 w-[40px] mb-1" />
              <Skeleton className="h-3 w-[60px]" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Skeleton className="size-4 rounded" />
            <Skeleton className="h-4 w-[110px]" />
          </div>
          <Skeleton className="h-3 w-[50px]" />
        </div>

        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border-0 border-l-4 border-l-zinc-200 bg-[var(--card)] px-4 py-3 shadow-[var(--shadow-card)]"
            >
              <Skeleton className="size-8 shrink-0 rounded-lg" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-4 w-[220px]" />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-[50px]" />
                  <Skeleton className="h-3 w-[70px]" />
                  <Skeleton className="h-3 w-[80px]" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Skeleton className="h-5 w-[50px] rounded-full" />
                <Skeleton className="h-5 w-[56px] rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
