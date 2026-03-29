import { Skeleton } from "@/components/ui/skeleton";

export default function RoutesLoading() {
  return (
    <div className="space-y-10">
      <div className="space-y-3">
        {/* Section header */}
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-4 w-[120px] mb-1" />
            <Skeleton className="h-3 w-[260px]" />
          </div>
        </div>

        {/* Flow cards */}
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border/50 bg-[var(--card)] p-4"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-[200px]" />
                    <Skeleton className="h-5 w-[60px] rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-[300px]" />
                  <div className="flex items-center gap-3 pt-1">
                    <Skeleton className="h-3 w-[80px]" />
                    <Skeleton className="h-3 w-[100px]" />
                    <Skeleton className="h-3 w-[70px]" />
                  </div>
                </div>
                <Skeleton className="size-8 shrink-0 rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
