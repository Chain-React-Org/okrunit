import { Skeleton } from "@/components/ui/skeleton";

function SettingsSectionSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 shrink-0 rounded-lg" />
        <div>
          <Skeleton className="h-4 w-[140px] mb-1" />
          <Skeleton className="h-3 w-[240px]" />
        </div>
      </div>
      {/* Section content */}
      <div className="rounded-xl border border-border/50 bg-[var(--card)] divide-y divide-border/40">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-[120px]" />
              <Skeleton className="h-3 w-[200px]" />
            </div>
            <Skeleton className="h-9 sm:w-[280px] w-full rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OrgSettingsLoading() {
  return (
    <div className="space-y-8 pb-24">
      <SettingsSectionSkeleton rows={1} />
      <SettingsSectionSkeleton rows={3} />
      <SettingsSectionSkeleton rows={2} />
      <SettingsSectionSkeleton rows={3} />
      <SettingsSectionSkeleton rows={1} />
    </div>
  );
}
