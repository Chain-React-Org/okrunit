import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function EmergencyLoading() {
  return (
    <PageContainer className="max-w-2xl">
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-[200px]" />
        <Skeleton className="h-4 w-[300px]" />
      </div>

      {/* Status card */}
      <div className="mb-6 rounded-xl border p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-[160px]" />
            <Skeleton className="h-3 w-[240px]" />
          </div>
        </div>
      </div>

      {/* Button */}
      <Skeleton className="h-11 w-[200px] rounded-lg" />
    </PageContainer>
  );
}
