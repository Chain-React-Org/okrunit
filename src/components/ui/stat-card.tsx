import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconNode?: ReactNode;
  subtitle?: string;
  trend?: { value: number; label: string };
  iconColor?: string;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconNode,
  subtitle,
  trend,
  iconColor = "text-muted-foreground",
  className,
  onClick,
}: StatCardProps) {
  const trendIsPositive = trend && trend.value >= 0;

  return (
    <Card
      className={cn("border border-border/50 shadow-[var(--shadow-card)]", onClick && "stat-card-hover cursor-pointer hover:border-border transition-colors", className)}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {title}
            </p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
          </div>
          <div className={cn("rounded-lg bg-muted/60 p-2.5", iconColor)}>
            {Icon ? <Icon className="size-4" /> : iconNode}
          </div>
        </div>
        {(subtitle || trend) && (
          <div className="mt-2 flex items-center gap-2 text-xs">
            {trend ? (
              <>
                <span className={cn(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
                  trendIsPositive
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-red-50 text-red-600"
                )}>
                  {trendIsPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                  {trendIsPositive ? "+" : ""}{trend.value}%
                </span>
                <span className="text-muted-foreground">{trend.label}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{subtitle}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
