"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOnboardingTourStore } from "@/stores/onboarding-tour-store";
import { findPageTour } from "@/components/onboarding/tour-steps";

/**
 * A subtle, dismissible hint shown on pages the user hasn't toured yet.
 * Disappears once the user starts the tour or dismisses it.
 */
export function TourHint() {
  const pathname = usePathname();
  const { activePageId, touredPages, startPageTour, synced } = useOnboardingTourStore();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted || !synced) return null;

  const pageTour = findPageTour(pathname);
  if (!pageTour) return null;

  // Don't show if already toured, currently touring, or dismissed this session
  if (touredPages.includes(pageTour.pageId)) return null;
  if (activePageId) return null;
  if (dismissed.has(pageTour.pageId)) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 mb-4">
      <Sparkles className="size-3.5 text-primary shrink-0" />
      <p className="text-xs text-foreground flex-1">
        New to this page? Take a quick tour to learn how it works.
      </p>
      <Button
        size="xs"
        variant="default"
        className="h-6 text-[11px] px-2.5 gap-1 bg-primary hover:bg-primary/90"
        onClick={() => startPageTour(pageTour.pageId)}
      >
        Tour this page
      </Button>
      <button
        onClick={() => setDismissed((prev) => new Set(prev).add(pageTour.pageId))}
        className="text-muted-foreground hover:text-foreground p-0.5"
        aria-label="Dismiss"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
