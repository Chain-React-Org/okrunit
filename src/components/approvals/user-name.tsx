"use client";

import { memo, useCallback } from "react";
import { toast } from "sonner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { titleCaseName } from "@/lib/format-name";
import type { UserProfile } from "@/lib/types/database";

interface UserNameProps {
  userId?: string | null;
  userProfiles?: Map<string, UserProfile>;
  /** Explicit override name (e.g., precomputed from a connection). */
  name?: string | null;
  className?: string;
}

function resolveLabel(
  userId: string | null | undefined,
  profile: UserProfile | undefined,
  name: string | null | undefined,
): string {
  if (name) return titleCaseName(name);
  if (profile?.full_name) return titleCaseName(profile.full_name);
  if (profile?.email) return profile.email;
  if (userId) return userId.slice(0, 8) + "…";
  return "Unknown";
}

export const UserName = memo(function UserName({
  userId,
  userProfiles,
  name,
  className,
}: UserNameProps) {
  const profile = userId ? userProfiles?.get(userId) : undefined;
  const displayLabel = resolveLabel(userId, profile, name);
  const email = profile?.email;

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      if (!email) return;
      e.stopPropagation();
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(email);
        toast.success("Email copied", { description: email });
      } catch {
        toast.error("Couldn't copy email");
      }
    },
    [email],
  );

  if (!email) {
    return <span className={className}>{displayLabel}</span>;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={handleCopy}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              void navigator.clipboard
                .writeText(email)
                .then(() => toast.success("Email copied", { description: email }))
                .catch(() => toast.error("Couldn't copy email"));
            }
          }}
          className={cn(
            "cursor-pointer underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] hover:decoration-foreground focus-visible:outline-none focus-visible:decoration-foreground",
            className,
          )}
        >
          {displayLabel}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <div className="space-y-0.5">
          <p className="font-medium text-zinc-900">{profile?.full_name ? titleCaseName(profile.full_name) : displayLabel}</p>
          <p className="text-[11px] text-zinc-600 break-all">{email}</p>
          <p className="text-[10px] text-zinc-500 pt-0.5">Click to copy email</p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
