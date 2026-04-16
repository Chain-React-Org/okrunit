"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { WizardProgress } from "./wizard-progress";
import { OrganizationStep } from "./organization-step";
import { InviteTeamStep } from "./invite-team-step";
import { ConnectMessagingStep } from "./connect-messaging-step";
import { Card, CardContent } from "@/components/ui/card";

const TOTAL_STEPS = 3;

interface SetupWizardProps {
  orgId: string;
  orgName: string;
  connectedPlatforms: string[];
  initialStep?: number;
  orgRenamed?: boolean;
  hasInvites?: boolean;
  hasMessaging?: boolean;
}

export function SetupWizard({
  orgId,
  orgName,
  connectedPlatforms,
  initialStep = 0,
  orgRenamed = false,
  hasInvites = false,
  hasMessaging = false,
}: SetupWizardProps) {
  const router = useRouter();

  // Derive which steps are already done from server data
  const serverCompletedSteps = new Set<number>();
  if (orgRenamed) serverCompletedSteps.add(0);
  if (hasInvites) serverCompletedSteps.add(1);
  if (hasMessaging) serverCompletedSteps.add(2);

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(serverCompletedSteps);
  const [finishing, setFinishing] = useState(false);

  // Step transition animation
  const [displayedStep, setDisplayedStep] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevStepRef = useRef<number | null>(null);

  useEffect(() => {
    if (finishing) return;
    if (prevStepRef.current !== null && prevStepRef.current !== currentStep) {
      setIsAnimating(true);
      const t = setTimeout(() => {
        setDisplayedStep(currentStep);
        setIsAnimating(false);
      }, 200);
      return () => clearTimeout(t);
    } else {
      setDisplayedStep(currentStep);
    }
    prevStepRef.current = currentStep;
  }, [currentStep, finishing]);

  // Save step progress to database (fire-and-forget)
  const saveStepToDb = useCallback((step: number) => {
    fetch("/api/auth/setup-step", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step }),
    }).catch(() => {});
  }, []);

  // If initialStep >= TOTAL_STEPS, complete setup immediately
  useEffect(() => {
    if (initialStep >= TOTAL_STEPS && !finishing) {
      handleCompleteSetup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToStep(step: number) {
    setCurrentStep(step);
  }

  function completeStep(step: number) {
    setCompletedSteps((prev) => new Set([...prev, step]));
    const nextStep = step + 1;
    setCurrentStep(nextStep);
    saveStepToDb(nextStep);
  }

  function skipStep(step: number) {
    const nextStep = step + 1;
    setCurrentStep(nextStep);
    saveStepToDb(nextStep);
  }

  async function handleCompleteSetup() {
    setFinishing(true);
    try {
      await fetch("/api/auth/complete-setup", { method: "POST" });
    } catch {
      // Non-blocking
    }
    router.push("/org/overview");
  }

  const stepToRender = displayedStep ?? currentStep;

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <WizardProgress
        currentStep={currentStep}
        completedSteps={[...completedSteps]}
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

            {/* Step past the end is handled by the effect above */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
