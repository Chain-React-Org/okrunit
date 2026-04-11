"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useOnboardingTourStore } from "@/stores/onboarding-tour-store";
import { PAGE_TOURS, FULL_TOUR_ORDER, findPageTour } from "@/components/onboarding/tour-steps";
import { TourTooltip } from "@/components/onboarding/tour-tooltip";
import { TourCursor } from "@/components/onboarding/tour-cursor";
import { TourAnimationEngine } from "@/components/onboarding/tour-animation-engine";

export function TourController() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    fullTourActive,
    fullTourPageIndex,
    activePageId,
    currentStepInPage,
    testRequestId,
    testFlowId,
    touredPages,
    tourDismissed,
    tourCompleted,
    tourPaused,
    hasSeenPauseHint,
    startPageTour,
    nextStepInPage,
    prevStepInPage,
    completePageTour,
    skipPageTour,
    advanceFullTour,
    pauseFullTour,
    completeFullTour,
    dismissFullTour,
    setTestRequestId,
    setTestFlowId,
    syncFromServer,
  } = useOnboardingTourStore();

  // Animation state
  const [cursorPos, setCursorPos] = useState({ x: -100, y: -100 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cursorClicking, setCursorClicking] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [overrideDescription, setOverrideDescription] = useState<string | undefined>();
  const engineRef = useRef<TourAnimationEngine | null>(null);

  // Sync tour state from server on mount. This runs on every dashboard page
  // (not just overview) so the synced flag is set before auto-start fires.
  useEffect(() => {
    syncFromServer();
  }, [syncFromServer]);

  const currentPageTour = useMemo(
    () => (activePageId ? PAGE_TOURS.find((p) => p.pageId === activePageId) ?? null : null),
    [activePageId],
  );

  // Full tour: navigate to next page and start its tour
  useEffect(() => {
    if (!fullTourActive || activePageId) return;

    const nextPageId = FULL_TOUR_ORDER[fullTourPageIndex];
    if (!nextPageId) {
      completeFullTour();
      setTimeout(() => router.push("/org/overview"), 100);
      return;
    }

    const pageTour = PAGE_TOURS.find((p) => p.pageId === nextPageId);
    if (!pageTour) {
      advanceFullTour();
      return;
    }

    const onCorrectPage = pathname === pageTour.pathname || pathname.startsWith(pageTour.pathname + "/");
    if (!onCorrectPage) {
      router.push(pageTour.pathname);
    }
    const delay = onCorrectPage ? 300 : 800;
    const timer = setTimeout(() => startPageTour(nextPageId), delay);
    return () => clearTimeout(timer);
  }, [fullTourActive, activePageId, fullTourPageIndex, pathname, router, completeFullTour, advanceFullTour, startPageTour]);

  // Create test request for requests page
  useEffect(() => {
    if (activePageId !== "requests" || testRequestId) return;
    fetch("/api/v1/onboarding", { method: "POST" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.data?.id) setTestRequestId(data.data.id); })
      .catch(() => {});
  }, [activePageId, testRequestId, setTestRequestId]);

  // Create test flow for routes page
  useEffect(() => {
    if (activePageId !== "routes" || testFlowId) return;
    fetch("/api/v1/onboarding?type=flow", { method: "POST" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.data?.id) {
          setTestFlowId(data.data.id);
          router.refresh();
        }
      })
      .catch(() => {});
  }, [activePageId, testFlowId, setTestFlowId, router]);

  // Clear paused state when navigating to a different page
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      if (tourPaused) {
        useOnboardingTourStore.setState({ tourPaused: false, pausedPageId: null, pausedStepIndex: 0, pausedWasFullTour: false });
      }
    }
  }, [pathname, tourPaused]);

  // Auto-start per-page tour on first visit (not in full tour mode, not paused)
  // Skip if tour was already completed or dismissed (synced from server)
  const synced = useOnboardingTourStore((s) => s.synced);
  useEffect(() => {
    if (!synced || fullTourActive || activePageId || tourPaused || tourCompleted || tourDismissed) return;

    const pageTour = findPageTour(pathname);

    if (pageTour && !touredPages.includes(pageTour.pageId)) {
      const timer = setTimeout(() => startPageTour(pageTour.pageId), 1000);
      return () => clearTimeout(timer);
    }
  }, [synced, pathname, fullTourActive, activePageId, tourPaused, tourCompleted, tourDismissed, touredPages, startPageTour]);

  // ---------- Animation Engine Management ----------------------------------

  const currentStep = currentPageTour?.steps[currentStepInPage];

  // Inject/remove a style tag that raises Radix portals above the tour overlay
  // so dialogs and selects opened by the animation engine are visible.
  useEffect(() => {
    if (!isAnimating) return;
    const style = document.createElement("style");
    style.id = "tour-animation-z-boost";
    style.textContent = `
      [data-slot="dialog-overlay"] { z-index: 9999 !important; }
      [data-slot="dialog-content"] { z-index: 10000 !important; }
      [data-radix-popper-content-wrapper] { z-index: 10000 !important; }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [isAnimating]);

  // Start animation engine when a step has an animation config
  useEffect(() => {
    if (!currentStep?.animation) {
      // No animation on this step. Clean up any previous engine.
      if (engineRef.current) {
        engineRef.current.abort();
        engineRef.current = null;
      }
      setIsAnimating(false);
      setCursorVisible(false);
      setOverrideDescription(undefined);
      return;
    }

    // Create and start the engine
    const engine = new TourAnimationEngine(currentStep.animation, {
      onCursorMove: (x, y) => {
        setCursorVisible(true);
        setCursorPos({ x, y });
      },
      onCursorClick: () => setCursorClicking(true),
      onCursorClickEnd: () => setCursorClicking(false),
      onTooltipUpdate: (text) => setOverrideDescription(text),
      onComplete: () => {
        setIsAnimating(false);
        setCursorVisible(false);
        setOverrideDescription(undefined);
        // Auto-advance to next step if configured
        if (currentStep.animation?.autoAdvance) {
          nextStepInPage();
        }
      },
    });

    engineRef.current = engine;
    setIsAnimating(true);

    // Small delay so the tooltip renders first, then animation starts
    const t = setTimeout(() => engine.start(), 600);
    return () => {
      clearTimeout(t);
      engine.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep?.id]);

  // ---------- Handlers -----------------------------------------------------

  const isFirstStep = currentStepInPage === 0;
  const isLastStep = currentPageTour ? currentStepInPage === currentPageTour.steps.length - 1 : false;

  const handleNext = useCallback(() => {
    if (isLastStep) {
      completePageTour();
      return;
    }
    nextStepInPage();
  }, [isLastStep, completePageTour, nextStepInPage]);

  const handleBack = useCallback(() => prevStepInPage(), [prevStepInPage]);

  const handleClose = useCallback(() => {
    // Stop any running animation
    if (engineRef.current) {
      engineRef.current.abort();
      engineRef.current = null;
    }
    setIsAnimating(false);
    setCursorVisible(false);

    if (fullTourActive) {
      pauseFullTour();
    } else {
      skipPageTour();
    }
  }, [fullTourActive, pauseFullTour, skipPageTour]);

  const handleSkip = useCallback(() => {
    // Stop any running animation
    if (engineRef.current) {
      engineRef.current.abort();
      engineRef.current = null;
    }
    setIsAnimating(false);
    setCursorVisible(false);

    if (fullTourActive) {
      dismissFullTour();
      setTimeout(() => router.push("/org/overview"), 100);
    } else {
      skipPageTour();
    }
  }, [fullTourActive, dismissFullTour, skipPageTour, router]);

  const handleSkipAnimation = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.abort();
      engineRef.current = null;
    }
    setIsAnimating(false);
    setCursorVisible(false);
    setOverrideDescription(undefined);
    // Advance past the animation step
    handleNext();
  }, [handleNext]);

  // ---------- Render -------------------------------------------------------

  if (!currentStep || !currentPageTour) {
    if (tourPaused && !hasSeenPauseHint) {
      return <PauseHint />;
    }
    return null;
  }

  const actionLabel = isLastStep
    ? fullTourActive ? "Next Page" : "Done"
    : currentStep.actionLabel ?? "Next";

  return (
    <>
      <TourTooltip
        targetSelector={currentStep.targetSelector}
        title={currentStep.title}
        description={currentStep.description}
        position={currentStep.position}
        highlightMode={currentStep.highlightMode}
        actionLabel={actionLabel}
        stepNumber={currentStepInPage + 1}
        totalSteps={currentPageTour.steps.length}
        onNext={handleNext}
        onBack={isFirstStep ? undefined : handleBack}
        onClose={handleClose}
        onSkip={handleSkip}
        isAnimating={isAnimating}
        overrideDescription={overrideDescription}
        onSkipAnimation={handleSkipAnimation}
      />
      <TourCursor
        x={cursorPos.x}
        y={cursorPos.y}
        visible={cursorVisible}
        clicking={cursorClicking}
      />
    </>
  );
}

function PauseHint() {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

  useEffect(() => {
    // Find the Help button in the header
    const helpBtn = document.querySelector("[data-tour-help-btn]");
    if (helpBtn) {
      const rect = helpBtn.getBoundingClientRect();
      setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    // Small delay before showing
    const showTimer = setTimeout(() => setVisible(true), 300);
    // Auto-dismiss after 5 seconds
    const hideTimer = setTimeout(() => {
      useOnboardingTourStore.setState({ hasSeenPauseHint: true });
      setVisible(false);
    }, 5300);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible || !position) return null;

  return createPortal(
    <div
      className="fixed z-[10000] w-64 rounded-lg border border-border bg-white shadow-lg dark:bg-card p-3 animate-in fade-in slide-in-from-top-2 duration-200"
      style={{ top: position.top, right: position.right }}
    >
      <button
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
        onClick={() => {
          useOnboardingTourStore.setState({ hasSeenPauseHint: true });
          setVisible(false);
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>
      <p className="text-xs text-foreground font-medium pr-4">You can resume the tour anytime from the Help menu above.</p>
    </div>,
    document.body,
  );
}
