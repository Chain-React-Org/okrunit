import { Skeleton } from "@/components/ui/skeleton";

export default function ConnectionsLoading() {
  return (
    <div>
      {/* Setup guides skeleton */}
      <div className="mb-8">
        <Skeleton className="h-4 w-[100px] mb-3" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Connection list skeleton */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-[180px]" />
                <Skeleton className="h-3 w-[260px]" />
              </div>
              <Skeleton className="h-8 w-[80px] rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
