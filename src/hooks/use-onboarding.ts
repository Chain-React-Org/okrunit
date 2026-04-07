"use client";

// ---------------------------------------------------------------------------
// OKrunit -- Onboarding State Hook
// Manages onboarding wizard progress and tour state via localStorage.
// ---------------------------------------------------------------------------

import { useState, useCallback, useEffect } from "react";

const WIZARD_KEY = "okrunit:onboarding:wizard";
const TOUR_KEY = "okrunit:onboarding:tour";
const BANNER_KEY = "okrunit:onboarding:banner_dismissed";

export interface WizardState {
  currentStep: number;
  completedSteps: number[];
  orgName?: string;
  connectionId?: string;
  apiKey?: string;
  testApprovalId?: string;
}

const DEFAULT_WIZARD: WizardState = {
  currentStep: 0,
  completedSteps: [],
};

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage full or unavailable - ignore
  }
}

// ---- Setup Wizard Hook ----------------------------------------------------

export function useSetupWizard() {
  const [state, setState] = useState<WizardState>(DEFAULT_WIZARD);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setState(readLocal(WIZARD_KEY, DEFAULT_WIZARD));
    setLoaded(true);
  }, []);

  const persist = useCallback((next: WizardState) => {
    setState(next);
    writeLocal(WIZARD_KEY, next);
  }, []);

  const goToStep = useCallback(
    (step: number) => {
      persist({ ...state, currentStep: step });
    },
    [state, persist],
  );

  const completeStep = useCallback(
    (step: number) => {
      const completedSteps = state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step];
      persist({ ...state, completedSteps, currentStep: step + 1 });
    },
    [state, persist],
  );

  const skipStep = useCallback(
    (step: number) => {
      persist({ ...state, currentStep: step + 1 });
    },
    [state, persist],
  );

  const updateData = useCallback(
    (data: Partial<WizardState>) => {
      persist({ ...state, ...data });
    },
    [state, persist],
  );

  const resetWizard = useCallback(() => {
    persist(DEFAULT_WIZARD);
  }, [persist]);

  const isComplete = state.completedSteps.length >= 3 || state.currentStep >= 3;

  return {
    state,
    loaded,
    goToStep,
    completeStep,
    skipStep,
    updateData,
    resetWizard,
    isComplete,
  };
}

// ---- Onboarding Tour Hook -------------------------------------------------

export function useOnboardingTour() {
  const [tourComplete, setTourComplete] = useState(true); // default true to avoid flash
  const [currentTourStep, setCurrentTourStep] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const complete = readLocal(TOUR_KEY, false);
    setTourComplete(complete);
    setLoaded(true);
  }, []);

  const completeTour = useCallback(() => {
    setTourComplete(true);
    writeLocal(TOUR_KEY, true);
  }, []);

  const resetTour = useCallback(() => {
    setTourComplete(false);
    setCurrentTourStep(0);
    writeLocal(TOUR_KEY, false);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentTourStep((prev) => prev + 1);
  }, []);

  const isNewUser = loaded && !tourComplete;

  return {
    isNewUser,
    tourComplete,
    currentTourStep,
    setCurrentTourStep,
    nextStep,
    completeTour,
    resetTour,
    loaded,
  };
}

// ---- Banner Dismissed Hook ------------------------------------------------

export function useOnboardingBanner() {
  const [dismissed, setDismissed] = useState(true); // default true to avoid flash
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setDismissed(readLocal(BANNER_KEY, false));
    setLoaded(true);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
    writeLocal(BANNER_KEY, true);
  }, []);

  return { dismissed, dismiss, loaded };
}
