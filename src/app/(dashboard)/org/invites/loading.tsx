import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function InvitesLoading() {
  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-4 pb-6">
        <div className="space-y-1">
          <Skeleton className="h-8 w-[100px]" />
          <Skeleton className="h-4 w-[260px]" />
        </div>
        <Skeleton className="h-9 w-[120px]" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border-0 p-4 shadow-[var(--shadow-card)]">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-[200px]" />
              <Skeleton className="h-3 w-[120px]" />
            </div>
            <Skeleton className="h-5 w-[70px] rounded-full" />
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
