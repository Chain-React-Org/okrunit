import { Skeleton } from "@/components/ui/skeleton";

export default function MembersLoading() {
  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex flex-1 items-center gap-2">
          {/* Search input */}
          <Skeleton className="h-9 flex-1 max-w-xs rounded-md" />
          {/* Role filter buttons */}
          <div className="flex items-center gap-1 rounded-lg border border-border/50 p-0.5">
            {["All", "Owners", "Admins", "Members"].map((label) => (
              <Skeleton key={label} className="h-7 w-[70px] rounded-md" />
            ))}
          </div>
        </div>
        {/* Export button */}
        <Skeleton className="h-9 w-[120px] rounded-md" />
      </div>

      {/* Member count */}
      <Skeleton className="h-3 w-[90px] mb-3" />

      {/* Member cards */}
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-border/50 px-4 py-3"
          >
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="flex-1 min-w-0 space-y-1">
              <Skeleton className="h-4 w-[160px]" />
              <Skeleton className="h-3 w-[200px]" />
            </div>
            {/* Activity stats (lg only) */}
            <div className="hidden lg:flex items-center gap-3 shrink-0">
              <Skeleton className="h-4 w-[40px]" />
              <Skeleton className="h-4 w-[40px]" />
            </div>
            {/* Approve toggle */}
            <div className="hidden sm:flex items-center gap-2 shrink-0">
              <Skeleton className="h-5 w-9 rounded-full" />
            </div>
            {/* Role */}
            <Skeleton className="h-6 w-[70px] shrink-0 rounded-full" />
          </div>
        ))}
      </div>
    </>
  );
}
