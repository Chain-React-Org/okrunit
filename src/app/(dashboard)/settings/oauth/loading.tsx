import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function OAuthSettingsLoading() {
  return (
    <PageContainer>
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-[220px]" />
        <Skeleton className="h-4 w-[340px]" />
      </div>

      {/* OAuth app cards */}
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-6">
            <Skeleton className="mb-2 h-5 w-[180px]" />
            <Skeleton className="mb-4 h-3 w-[280px]" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-[60px] rounded-full" />
              <Skeleton className="h-5 w-[50px] rounded-full" />
              <Skeleton className="h-5 w-[70px] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
