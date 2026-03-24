import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function AdminLoading() {
  return (
    <PageContainer>
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-[200px]" />
        <Skeleton className="h-4 w-[300px]" />
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <Skeleton className="h-3 w-[80px]" />
                <Skeleton className="h-9 w-[50px]" />
              </div>
              <Skeleton className="size-11 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Tabbed interface */}
      <div className="rounded-xl border p-6">
        {/* Tab bar */}
        <div className="mb-6 flex gap-4 border-b pb-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-[70px]" />
          ))}
        </div>

        {/* Table skeleton */}
        <div className="space-y-3">
          {/* Table header */}
          <div className="flex gap-4">
            <Skeleton className="h-3 w-[120px]" />
            <Skeleton className="h-3 w-[80px]" />
            <Skeleton className="h-3 w-[100px]" />
            <Skeleton className="h-3 w-[60px]" />
          </div>
          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
