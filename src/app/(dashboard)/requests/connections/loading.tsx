import { Skeleton } from "@/components/ui/skeleton";

export default function ConnectionsLoading() {
  return (
    <div>
      {/* Setup guides */}
      <div className="mb-8">
        <Skeleton className="h-3 w-[90px] mb-3" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-[var(--card)] px-4 py-3"
            >
              <Skeleton className="size-6 shrink-0 rounded" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="size-3.5 shrink-0" />
            </div>
          ))}
        </div>
      </div>

      {/* Connection list */}
      <div className="space-y-3">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-[140px]" />
          <Skeleton className="h-9 w-[160px] rounded-md" />
        </div>

        {/* Connection cards */}
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-[var(--card)] p-4"
          >
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-5 w-[180px]" />
                  <Skeleton className="h-5 w-[50px] rounded-full" />
                </div>
                <Skeleton className="h-3 w-[280px]" />
                <div className="flex items-center gap-3 pt-1">
                  <Skeleton className="h-3 w-[100px]" />
                  <Skeleton className="h-3 w-[80px]" />
                </div>
              </div>
              <Skeleton className="size-8 shrink-0 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
