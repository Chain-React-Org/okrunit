import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <>
      {/* Page header skeleton */}
      <div className="flex items-start justify-between gap-4 pb-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-[120px]" />
          <Skeleton className="h-4 w-[380px]" />
        </div>
      </div>

      {/* Notification settings form skeleton */}
      <div className="space-y-6">
        {/* Section card */}
        <div className="rounded-xl border-0 p-6 shadow-[var(--shadow-card)]">
          <Skeleton className="mb-6 h-5 w-[200px]" />
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-[180px]" />
                  <Skeleton className="h-3 w-[260px]" />
                </div>
                <Skeleton className="h-5 w-9 rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Email settings card */}
        <div className="rounded-xl border-0 p-6 shadow-[var(--shadow-card)]">
          <Skeleton className="mb-6 h-5 w-[160px]" />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-9 w-full" />
            </div>
          </div>
        </div>

        {/* OAuth apps link card */}
        <div className="rounded-xl border-0 p-6 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-lg" />
              <div className="space-y-1">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-3 w-[280px]" />
              </div>
            </div>
            <Skeleton className="h-4 w-[60px]" />
          </div>
        </div>
      </div>
    </>
  );
}
