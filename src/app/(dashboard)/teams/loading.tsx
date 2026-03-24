import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function TeamsLoading() {
  return (
    <PageContainer>
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-[120px]" />
        <Skeleton className="h-4 w-[260px]" />
      </div>

      {/* Team cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <Skeleton className="h-5 w-[160px]" />
                <Skeleton className="h-3 w-[240px]" />
              </div>
              <Skeleton className="h-8 w-[80px] rounded-lg" />
            </div>
            <div className="mt-4 flex gap-2">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="size-8 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
