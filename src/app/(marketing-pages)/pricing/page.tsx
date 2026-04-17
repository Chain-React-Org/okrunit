import type { Metadata } from "next";
import Link from "next/link";
import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_LIMITS, PLAN_ORDER, isUnlimited } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Pricing - OKrunit",
  description: "Simple, transparent pricing for human-in-the-loop approval workflows. Free tier included.",
  alternates: { canonical: "https://okrunit.com/pricing" },
};

export default function PricingPage() {
  return (
    <div>
      <div className="mb-12">
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-zinc-600">
          Start free, upgrade when you need more. No hidden fees, no per-seat pricing for the free tier.
        </p>
      </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((planId) => {
            const plan = PLAN_LIMITS[planId];
            const isEnterprise = planId === "enterprise";
            const isPro = planId === "pro";

            return (
              <div
                key={planId}
                className={cn(
                  "rounded-2xl border p-6 flex flex-col",
                  isPro && "border-primary ring-1 ring-primary/20 relative",
                  isEnterprise && "bg-zinc-900 text-white border-zinc-800",
                  !isPro && !isEnterprise && "border-zinc-200",
                )}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                      Most Popular
                    </span>
                  </div>
                )}

                <h3 className={cn("text-lg font-bold", !isEnterprise && "text-zinc-900")}>
                  {plan.name}
                </h3>

                <div className="mt-3">
                  {isEnterprise ? (
                    <span className="text-3xl font-bold">Custom</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold">${plan.priceMonthly}</span>
                      {plan.priceMonthly > 0 && (
                        <span className={cn("text-sm", isEnterprise ? "text-white/60" : "text-zinc-500")}>/month</span>
                      )}
                    </>
                  )}
                </div>

                <ul className="mt-6 space-y-3 flex-1">
                  <li className="flex items-start gap-2 text-sm">
                    <Check className={cn("size-4 mt-0.5 shrink-0", isEnterprise ? "text-white/80" : "text-primary")} />
                    {isUnlimited(plan.maxRequests) ? "Unlimited" : plan.maxRequests} requests/mo
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className={cn("size-4 mt-0.5 shrink-0", isEnterprise ? "text-white/80" : "text-primary")} />
                    {isUnlimited(plan.maxConnections) ? "Unlimited" : plan.maxConnections} connections
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className={cn("size-4 mt-0.5 shrink-0", isEnterprise ? "text-white/80" : "text-primary")} />
                    {isUnlimited(plan.maxTeams) ? "Unlimited" : plan.maxTeams} team{plan.maxTeams !== 1 ? "s" : ""}
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className={cn("size-4 mt-0.5 shrink-0", isEnterprise ? "text-white/80" : "text-primary")} />
                    {isUnlimited(plan.maxTeamMembers) ? "Unlimited" : plan.maxTeamMembers} team members
                  </li>
                  <li className="flex items-start gap-2 text-sm">
                    <Check className={cn("size-4 mt-0.5 shrink-0", isEnterprise ? "text-white/80" : "text-primary")} />
                    {isUnlimited(plan.historyDays) ? "Unlimited" : `${plan.historyDays}-day`} history
                  </li>
                </ul>

                <div className="mt-6">
                  {isEnterprise ? (
                    <Button variant="outline" className="w-full border-white/30 text-white hover:bg-white/10" asChild>
                      <a href="mailto:sales@okrunit.com">Talk to Sales</a>
                    </Button>
                  ) : (
                    <Button className="w-full" variant={isPro ? "default" : "outline"} asChild>
                      <Link href="/signup">
                        {plan.priceMonthly === 0 ? "Start Free" : "Get Started"}
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      <div className="mt-12 text-center">
        <p className="text-sm text-zinc-500">
          All plans include email notifications. Annual billing saves 15%+.{" "}
          <Link href="/docs/billing" className="text-primary hover:underline">
            View full comparison &rarr;
          </Link>
        </p>
      </div>
    </div>
  );
}
