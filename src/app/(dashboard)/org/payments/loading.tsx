import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function PaymentsLoading() {
  return (
    <PageContainer>
      <div className="space-y-1 pb-6">
        <Skeleton className="h-8 w-[140px]" />
        <Skeleton className="h-4 w-[260px]" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border-0 p-4 shadow-[var(--shadow-card)]">
            <Skeleton className="h-4 w-[100px]" />
            <Skeleton className="h-4 w-[80px]" />
            <Skeleton className="h-5 w-[60px] rounded-full" />
            <div className="flex-1" />
            <Skeleton className="h-4 w-[70px]" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
