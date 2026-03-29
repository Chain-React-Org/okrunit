import { Skeleton } from "@/components/ui/skeleton";

export default function MessagingLoading() {
  return (
    <div className="space-y-8">
      {/* Platform cards — 5 columns on md */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-2 rounded-xl border border-border/50 bg-[var(--card)] p-4"
          >
            <Skeleton className="size-10 rounded-lg" />
            <Skeleton className="h-4 w-[60px]" />
            <Skeleton className="h-3 w-[80px]" />
            <Skeleton className="h-7 w-full rounded-md mt-1" />
          </div>
        ))}
      </div>

      {/* Connected channels section */}
      <div className="space-y-3">
        <Skeleton className="h-3 w-[140px]" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-border/50 bg-[var(--card)] p-4"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-[160px]" />
                  <Skeleton className="h-3 w-[120px]" />
                </div>
              </div>
              <Skeleton className="size-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
