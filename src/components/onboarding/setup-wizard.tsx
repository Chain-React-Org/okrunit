"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSetupWizard } from "@/hooks/use-onboarding";
import { WizardProgress } from "./wizard-progress";
import { OrganizationStep } from "./organization-step";
import { InviteTeamStep } from "./invite-team-step";
import { ConnectMessagingStep } from "./connect-messaging-step";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SetupWizardProps {
  orgId: string;
  orgName: string;
  connectedPlatforms: string[];
}

export function SetupWizard({
  orgId,
  orgName,
  connectedPlatforms,
}: SetupWizardProps) {
  const router = useRouter();
  const {
    state,
    loaded,
    goToStep,
    completeStep,
    skipStep,
    resetWizard,
    isComplete,
  } = useSetupWizard();

  // Track step transitions for animation
  const [displayedStep, setDisplayedStep] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const prevStepRef = useRef<number | null>(null);

  const currentStep = state.currentStep;

  // Animate step transitions (skip if we're finishing setup)
  useEffect(() => {
    if (!loaded || finishing) return;

    if (displayedStep === null) {
      // Initial render. Show immediately
      setDisplayedStep(currentStep);
      prevStepRef.current = currentStep;
      return;
    }

    if (currentStep !== prevStepRef.current) {
      // Step changed. Trigger exit animation, then swap content
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setDisplayedStep(currentStep);
        setIsAnimating(false);
        prevStepRef.current = currentStep;
      }, 200); // matches wizardSlideOut duration
      return () => clearTimeout(timer);
    }
  }, [currentStep, loaded, displayedStep, finishing]);

  // Edge case: if step is past the end, complete setup via effect (not during render)
  const didComplete = useRef(false);
  useEffect(() => {
    if (loaded && !finishing && !didComplete.current && currentStep >= 3) {
      didComplete.current = true;
      handleCompleteSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, finishing, currentStep]);

  // If localStorage says complete but we're still on /setup, the DB was reset.
  // Clear the stale localStorage state so the wizard starts fresh.
  // Skip if we're in the process of finishing (to avoid flashing step 0).
  const didReset = useRef(false);
  useEffect(() => {
    if (loaded && isComplete && !didReset.current && !finishing) {
      didReset.current = true;
      resetWizard();
    }
  }, [loaded, isComplete, resetWizard, finishing]);

  // Show skeleton while loading localStorage state or resetting stale state
  // Don't show skeleton if we're finishing (stay on last step)
  if (!loaded || (isComplete && !didReset.current && !finishing)) {
    return (
      <Card>
        <CardContent className="space-y-6 p-8">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    );
  }

  async function handleCompleteSetup() {
    // Freeze the UI on the current step while we finish up
    setFinishing(true);
    try {
      await fetch("/api/auth/complete-setup", { method: "POST" });
    } catch {
      // Non-blocking. The layout gate will still redirect if this fails
    }
    // Mark complete in localStorage after the DB call so the reset effect
    // doesn't fire before we navigate away.
    completeStep(2);
    router.push("/org/overview");
  }

  const stepToRender = displayedStep ?? currentStep;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <WizardProgress
        currentStep={currentStep}
        completedSteps={state.completedSteps}
        onStepClick={goToStep}
      />

      {/* Step content */}
      <Card className="overflow-hidden">
        <CardContent className="p-6 sm:p-8">
          <div
            key={stepToRender}
            style={{
              animation: isAnimating
                ? "wizardSlideOut 200ms ease-in forwards"
                : "wizardSlideIn 350ms ease-out",
            }}
          >
            {stepToRender === 0 && (
              <OrganizationStep
                initialName={orgName}
                orgId={orgId}
                onComplete={() => completeStep(0)}
              />
            )}

            {stepToRender === 1 && (
              <InviteTeamStep
                onComplete={() => completeStep(1)}
                onBack={() => goToStep(0)}
                onSkip={() => skipStep(1)}
              />
            )}

            {stepToRender === 2 && (
              <ConnectMessagingStep
                connectedPlatforms={connectedPlatforms}
                onComplete={() => {
                  handleCompleteSetup();
                }}
                onBack={() => goToStep(1)}
                onSkip={() => {
                  handleCompleteSetup();
                }}
              />
            )}

            {/* Edge case: step past the end, handled by effect below */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
