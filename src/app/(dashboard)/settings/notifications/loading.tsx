import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function NotificationSettingsLoading() {
  return (
    <PageContainer>
      <div className="space-y-1 pb-6">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-4 w-[320px]" />
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border-0 p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Skeleton className="h-5 w-[140px]" />
                <Skeleton className="h-3 w-[240px]" />
              </div>
              <Skeleton className="h-6 w-10 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
