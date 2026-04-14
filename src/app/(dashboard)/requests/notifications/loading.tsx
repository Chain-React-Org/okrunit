import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function NotificationsLoading() {
  return (
    <PageContainer>
      <div className="space-y-1 pb-6">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-4 w-[340px]" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border-0 p-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3">
              <Skeleton className="size-8 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-[260px]" />
                <Skeleton className="h-3 w-[180px]" />
              </div>
              <Skeleton className="h-5 w-[60px] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
