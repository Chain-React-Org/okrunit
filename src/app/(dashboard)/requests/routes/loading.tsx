import { Skeleton } from "@/components/ui/skeleton";

export default function RoutesLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-[160px]" />
        <Skeleton className="h-9 w-[120px] rounded-md" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-[200px]" />
              <Skeleton className="h-3 w-[300px]" />
            </div>
            <Skeleton className="h-8 w-[80px] rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
