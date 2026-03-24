"use client";

import { useSetupWizard, useOnboardingBanner } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { X, Sparkles, ArrowRight } from "lucide-react";
import Link from "next/link";

export function OnboardingBanner() {
  const { isComplete, loaded: wizardLoaded } = useSetupWizard();
  const { dismissed, dismiss, loaded: bannerLoaded } = useOnboardingBanner();

  // Don't render until both states are loaded from localStorage
  if (!wizardLoaded || !bannerLoaded) return null;

  // Don't show if wizard is complete or banner was dismissed
  if (isComplete || dismissed) return null;

  return (
    <div className="flex items-center gap-3 border-b border-border/50 bg-muted/30 px-8 py-3 mb-6">
      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
        <Sparkles className="size-3.5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-snug">Complete your setup</p>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Finish the setup wizard to start receiving approval requests.
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button size="xs" variant="default" asChild>
          <Link href="/setup" className="gap-1">
            Continue
            <ArrowRight className="size-2.5" />
          </Link>
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={dismiss}
          title="Dismiss"
          className="text-muted-foreground hover:text-foreground h-6 w-6"
        >
          <X className="size-3" />
        </Button>
      </div>
    </div>
  );
}
