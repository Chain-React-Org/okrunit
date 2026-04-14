import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function SSOLoading() {
  return (
    <PageContainer>
      <div className="space-y-1 pb-6">
        <Skeleton className="h-8 w-[60px]" />
        <Skeleton className="h-4 w-[320px]" />
      </div>
      <div className="rounded-xl border-0 p-6 shadow-[var(--shadow-card)]">
        <Skeleton className="mb-4 h-5 w-[180px]" />
        <Skeleton className="h-3 w-[300px]" />
        <Skeleton className="mt-6 h-9 w-[160px]" />
      </div>
    </PageContainer>
  );
}
