import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function CalendarLoading() {
  return (
    <PageContainer>
      <div className="space-y-1 pb-6">
        <Skeleton className="h-8 w-[140px]" />
        <Skeleton className="h-4 w-[280px]" />
      </div>
      <div className="space-y-4">
        <div className="rounded-xl border-0 p-6 shadow-[var(--shadow-card)]">
          <Skeleton className="mb-4 h-5 w-[160px]" />
          <Skeleton className="h-9 w-[200px]" />
        </div>
      </div>
    </PageContainer>
  );
}
