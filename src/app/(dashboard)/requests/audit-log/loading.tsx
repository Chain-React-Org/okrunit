import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-[140px]" />
      <Skeleton className="h-9 w-full rounded-md" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-[280px]" />
              <Skeleton className="h-3 w-[160px]" />
            </div>
            <Skeleton className="h-3 w-[80px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
