import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function RequestsLoading() {
  return (
    <PageContainer>
      {/* Page header skeleton */}
      <div className="flex items-start justify-between gap-4 pb-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-[160px]" />
          <Skeleton className="h-4 w-[360px]" />
        </div>
      </div>

      <div className="space-y-6">
        {/* Live indicator + layout toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-[50px]" />
            <Skeleton className="h-7 w-[80px]" />
          </div>
          <Skeleton className="h-8 w-[120px]" />
        </div>

        {/* Stat cards skeleton — 3 column grid */}
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border-0 p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-[70px]" />
                  <Skeleton className="h-8 w-[50px]" />
                </div>
                <Skeleton className="size-10 rounded-lg" />
              </div>
              <Skeleton className="mt-3 h-3 w-[100px]" />
            </div>
          ))}
        </div>

        {/* Filter bar skeleton */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-9 flex-1" />
          <Skeleton className="h-9 w-[130px]" />
          <Skeleton className="h-9 w-[130px]" />
          <Skeleton className="h-9 w-[150px]" />
        </div>

        {/* Request cards skeleton */}
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border-0 border-l-4 border-l-zinc-200 p-0 shadow-[var(--shadow-card)]"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="size-8 rounded-lg" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-[240px]" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-3 w-[60px]" />
                    <Skeleton className="h-3 w-[80px]" />
                    <Skeleton className="h-3 w-[70px]" />
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
