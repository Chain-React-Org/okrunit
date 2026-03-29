import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[120px]" />
        <Skeleton className="h-9 w-[140px] rounded-md" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-4 w-[180px]" />
            <Skeleton className="h-3 w-[220px]" />
          </div>
          <Skeleton className="h-6 w-[60px] rounded-full" />
        </div>
      ))}
    </div>
  );
}
