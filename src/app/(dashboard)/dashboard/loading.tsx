import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function DashboardLoading() {
  return (
    <PageContainer>
      {/* Org header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-7 w-[260px]" />
      </div>

      {/* Stat cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start justify-between">
              <div className="space-y-3">
                <Skeleton className="h-3 w-[80px]" />
                <Skeleton className="h-9 w-[50px]" />
              </div>
              <Skeleton className="size-11 rounded-lg" />
            </div>
            <Skeleton className="mt-4 h-3 w-[100px]" />
          </div>
        ))}
      </div>

      {/* Content cards */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border p-6 lg:col-span-2">
          <Skeleton className="mb-4 h-5 w-[120px]" />
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-6">
          <Skeleton className="mb-4 h-5 w-[100px]" />
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
