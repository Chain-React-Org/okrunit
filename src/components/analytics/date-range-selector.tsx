"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BillingPlan } from "@/lib/types/database";
import { PLAN_LIMITS } from "@/lib/billing/plans";
import { PERIOD_OPTIONS } from "./analytics-periods";

interface DateRangeSelectorProps {
  currentDays: number;
  plan: BillingPlan;
}

export function DateRangeSelector({ currentDays, plan }: DateRangeSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const historyDays = PLAN_LIMITS[plan].historyDays;

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "30") {
      params.delete("days");
    } else {
      params.set("days", value);
    }
    const qs = params.toString();
    router.push(qs ? `?${qs}` : "?", { scroll: false });
  }

  return (
    <Select value={String(currentDays)} onValueChange={handleChange}>
      <SelectTrigger size="sm" className="w-[160px] bg-white dark:bg-card">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper" align="end">
        {PERIOD_OPTIONS.map((option) => {
          const locked = historyDays !== -1 && option.days > historyDays;
          return (
            <SelectItem
              key={option.value}
              value={option.value}
              disabled={locked}
            >
              <span className="flex items-center gap-2">
                {option.label}
                {locked && <Lock className="size-3 text-muted-foreground" />}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
