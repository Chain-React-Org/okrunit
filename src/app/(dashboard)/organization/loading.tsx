import { Skeleton } from "@/components/ui/skeleton";
import { PageContainer } from "@/components/ui/page-container";

export default function OrganizationLoading() {
  return (
    <PageContainer>
      {/* Page header */}
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-[240px]" />
        <Skeleton className="h-4 w-[320px]" />
      </div>

      {/* Form card */}
      <div className="rounded-xl border p-6">
        <div className="space-y-6">
          {/* Input fields */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-[100px]" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}

          {/* Save button */}
          <Skeleton className="h-10 w-[120px] rounded-lg" />
        </div>
      </div>
    </PageContainer>
  );
}
