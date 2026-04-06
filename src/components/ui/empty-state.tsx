import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "default" | "outline";
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-5 py-20", className)}>
      <div className="empty-state-icon rounded-2xl p-5">
        <Icon className="size-9 text-muted-foreground/70" />
      </div>
      <div className="text-center space-y-2 max-w-sm">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && (
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <Button variant={action.variant ?? "default"} onClick={action.onClick} className={cn("mt-1", action.variant === "outline" && "bg-white")}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
