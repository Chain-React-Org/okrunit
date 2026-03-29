import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogLoading() {
  return (
    <div className="space-y-4">
      {/* Filter row */}
      <div className="flex gap-3">
        <Skeleton className="h-9 w-[200px] rounded-md" />
        <Skeleton className="h-9 w-[200px] rounded-md" />
      </div>

      {/* Audit log table */}
      <div className="rounded-xl border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b px-4 py-3 last:border-b-0"
          >
            <Skeleton className="h-4 w-[120px] shrink-0" />
            <Skeleton className="h-5 w-[70px] shrink-0 rounded-full" />
            <Skeleton className="h-4 w-[90px] shrink-0" />
            <Skeleton className="h-4 w-[80px] shrink-0" />
            <Skeleton className="h-4 w-[130px] flex-1" />
            <Skeleton className="h-4 w-[100px] shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
