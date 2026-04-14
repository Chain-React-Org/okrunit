import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function SafetyLoading() {
  return (
    <PageContainer>
      <div className="space-y-1 pb-6">
        <Skeleton className="h-8 w-[120px]" />
        <Skeleton className="h-4 w-[300px]" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border-0 p-6 shadow-[var(--shadow-card)]">
            <Skeleton className="mb-3 h-5 w-[160px]" />
            <Skeleton className="h-3 w-[280px]" />
            <Skeleton className="mt-4 h-9 w-[120px]" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
