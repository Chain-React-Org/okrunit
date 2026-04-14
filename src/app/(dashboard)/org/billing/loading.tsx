import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function BillingLoading() {
  return (
    <PageContainer>
      <div className="space-y-1 pb-6">
        <Skeleton className="h-8 w-[100px]" />
        <Skeleton className="h-4 w-[280px]" />
      </div>
      <div className="space-y-6">
        <div className="rounded-xl border-0 p-6 shadow-[var(--shadow-card)]">
          <Skeleton className="mb-2 h-5 w-[120px]" />
          <Skeleton className="h-8 w-[80px]" />
          <Skeleton className="mt-4 h-9 w-[160px]" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border-0 p-5 shadow-[var(--shadow-card)]">
              <Skeleton className="mb-2 h-4 w-[80px]" />
              <Skeleton className="h-7 w-[60px]" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
