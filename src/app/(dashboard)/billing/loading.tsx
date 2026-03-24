import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function BillingLoading() {
  return (
    <PageContainer>
      {/* Org header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-7 w-[220px]" />
      </div>

      {/* Usage stats + upgrade CTA */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Usage bars card */}
        <div className="rounded-xl border p-6 lg:col-span-2">
          <Skeleton className="mb-6 h-5 w-[140px]" />
          <div className="space-y-5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-3 w-[100px]" />
                  <Skeleton className="h-3 w-[60px]" />
                </div>
                <Skeleton className="h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>

        {/* Upgrade CTA card */}
        <div className="rounded-xl border p-6">
          <Skeleton className="mb-3 h-5 w-[120px]" />
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="mb-6 h-3 w-[80%]" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      </div>

      {/* Plan cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6">
            <Skeleton className="mb-2 h-4 w-[80px]" />
            <Skeleton className="mb-4 h-8 w-[100px]" />
            <div className="mb-4 space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="h-3 w-full" />
              ))}
            </div>
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        ))}
      </div>

      {/* Invoice table */}
      <div className="rounded-xl border p-6">
        <Skeleton className="mb-4 h-5 w-[100px]" />
        <div className="space-y-3">
          {/* Table header */}
          <div className="flex gap-4">
            <Skeleton className="h-3 w-[100px]" />
            <Skeleton className="h-3 w-[80px]" />
            <Skeleton className="h-3 w-[60px]" />
            <Skeleton className="h-3 w-[80px]" />
          </div>
          {/* Table rows */}
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
