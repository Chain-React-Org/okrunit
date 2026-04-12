"use client";

import { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { useOnboardingTourStore } from "@/stores/onboarding-tour-store";
import { PAGE_TOURS, findPageTour } from "@/components/onboarding/tour-steps";
import { TourTooltip } from "@/components/onboarding/tour-tooltip";
import { TourCursor } from "@/components/onboarding/tour-cursor";
import { TourAnimationEngine } from "@/components/onboarding/tour-animation-engine";

export function TourController() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    activePageId,
    currentStepInPage,
    testRequestId,
    testFlowId,
    startPageTour,
    nextStepInPage,
    prevStepInPage,
    completePageTour,
    skipPageTour,
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

  // Sync tour state from server on mount
  useEffect(() => {
    syncFromServer();
  }, [syncFromServer]);

  const currentPageTour = useMemo(
    () => (activePageId ? PAGE_TOURS.find((p) => p.pageId === activePageId) ?? null : null),
    [activePageId],
  );

  // Create test request for requests page tour
  useEffect(() => {
    if (activePageId !== "requests" || testRequestId) return;
    fetch("/api/v1/onboarding", { method: "POST" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => { if (data?.data?.id) setTestRequestId(data.data.id); })
      .catch(() => {});
  }, [activePageId, testRequestId, setTestRequestId]);

  // Create test flow for routes page tour
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

  // ---------- Animation Engine Management ----------------------------------

  const currentStep = currentPageTour?.steps[currentStepInPage];

  // Inject/remove a style tag that raises Radix portals above the tour overlay
  // so dialogs and selects opened by the animation engine are visible.
  useEffect(() => {
    if (!isAnimating) return;
    const style = document.createElement("style");
    style.id = "tour-animation-z-boost";
    style.textContent = `
      [data-radix-popper-content-wrapper] { z-index: 10001 !important; }
      [data-slot="dialog-overlay"] { z-index: 10000 !important; }
      [data-slot="dialog-content"] { z-index: 10001 !important; }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, [isAnimating]);

  useEffect(() => {
    if (!currentStep?.animation) {
      if (engineRef.current) {
        engineRef.current.abort();
        engineRef.current = null;
      }
      setIsAnimating(false);
      setCursorVisible(false);
      setOverrideDescription(undefined);
      return;
    }

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
        if (currentStep.animation?.autoAdvance) {
          const isLast = currentPageTour && currentStepInPage === currentPageTour.steps.length - 1;
          if (isLast) {
            completePageTour();
          } else {
            nextStepInPage();
          }
        }
      },
    });

    engineRef.current = engine;
    setIsAnimating(true);

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
    if (engineRef.current) {
      engineRef.current.abort();
      engineRef.current = null;
    }
    setIsAnimating(false);
    setCursorVisible(false);
    skipPageTour();
  }, [skipPageTour]);

  const handleSkipAnimation = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.abort();
      engineRef.current = null;
    }
    setIsAnimating(false);
    setCursorVisible(false);
    setOverrideDescription(undefined);
    handleNext();
  }, [handleNext]);

  // ---------- Render -------------------------------------------------------

  if (!currentStep || !currentPageTour) {
    return null;
  }

  const actionLabel = isLastStep ? "Done" : currentStep.actionLabel ?? "Next";

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
        onSkip={handleClose}
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
