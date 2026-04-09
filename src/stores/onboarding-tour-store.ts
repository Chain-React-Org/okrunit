import { create } from "zustand";
import { persist } from "zustand/middleware";

interface OnboardingTourState {
  // Full tour
  fullTourActive: boolean;
  fullTourPageIndex: number;
  tourCompleted: boolean;
  tourDismissed: boolean;

  // Per-page tour
  activePageId: string | null;
  currentStepInPage: number;
  touredPages: string[];

  // Pause state - true when user clicked outside tooltip
  tourPaused: boolean;
  pausedPageId: string | null;
  pausedStepIndex: number;
  pausedWasFullTour: boolean;

  // Hint state - show "Resume Tour is in Help" hint once
  hasSeenPauseHint: boolean;

  // Test data
  testRequestId: string | null;
  synced: boolean;
  userId: string | null;

  // Full tour actions
  startFullTour: () => void;
  pauseFullTour: () => void;
  resumeTour: (currentPathname?: string) => void;
  advanceFullTour: () => void;
  completeFullTour: () => void;
  dismissFullTour: () => void;

  // Per-page actions
  startPageTour: (pageId: string) => void;
  nextStepInPage: () => void;
  prevStepInPage: () => void;
  completePageTour: () => void;
  skipPageTour: () => void;

  // Shared
  setTestRequestId: (id: string | null) => void;
  resetSync: () => void;
  syncFromServer: () => Promise<void>;
}

function saveToServer(state: Record<string, unknown>) {
  fetch("/api/v1/onboarding/tour-state", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  }).catch(() => {});
}

function deleteTestRequest() {
  fetch("/api/v1/onboarding", { method: "DELETE" })
    .then(() => {
      // Notify sidebar to refresh pending count since admin deletes
      // may not trigger Supabase Realtime events
      window.dispatchEvent(new CustomEvent("onboarding-test-deleted"));
    })
    .catch(() => {});
}

export const useOnboardingTourStore = create<OnboardingTourState>()(
  persist(
    (set, get) => ({
      fullTourActive: false,
      fullTourPageIndex: 0,
      tourCompleted: false,
      tourDismissed: false,
      activePageId: null,
      currentStepInPage: 0,
      touredPages: [],
      tourPaused: false,
      pausedPageId: null,
      pausedStepIndex: 0,
      pausedWasFullTour: false,
      hasSeenPauseHint: false,
      testRequestId: null,
      synced: false,
      userId: null,

      startFullTour: () => {
        set({ fullTourActive: true, fullTourPageIndex: 0, activePageId: null, currentStepInPage: 0, tourCompleted: false, tourDismissed: false, tourPaused: false, pausedPageId: null, pausedStepIndex: 0, pausedWasFullTour: false });
        saveToServer({ currentStep: 0, tourCompleted: false, tourDismissed: false });
      },
      pauseFullTour: () => {
        const { activePageId, currentStepInPage, fullTourActive, testRequestId } = get();
        // Clean up test request if one exists
        if (testRequestId) {
          deleteTestRequest();
        }
        set({ fullTourActive: false, activePageId: null, testRequestId: null, tourPaused: true, pausedPageId: activePageId, pausedStepIndex: currentStepInPage, pausedWasFullTour: fullTourActive });
      },
      resumeTour: (overridePageId?: string) => {
        const { pausedPageId, pausedStepIndex, pausedWasFullTour } = get();
        const pageId = overridePageId ?? pausedPageId;
        const stepIndex = overridePageId && overridePageId !== pausedPageId ? 0 : pausedStepIndex;

        if (pageId) {
          set({ activePageId: pageId, currentStepInPage: stepIndex, fullTourActive: pausedWasFullTour, tourPaused: false, pausedPageId: null, pausedStepIndex: 0, pausedWasFullTour: false });
        } else {
          get().startFullTour();
        }
      },
      advanceFullTour: () => {
        set((s) => ({ fullTourPageIndex: s.fullTourPageIndex + 1, currentStepInPage: 0 }));
      },
      completeFullTour: () => {
        if (get().testRequestId) fetch("/api/v1/onboarding", { method: "DELETE" }).catch(() => {});
        set({ fullTourActive: false, activePageId: null, tourCompleted: true, testRequestId: null, tourPaused: false, pausedPageId: null });
        saveToServer({ tourCompleted: true, tourDismissed: false });
      },
      dismissFullTour: () => {
        if (get().testRequestId) fetch("/api/v1/onboarding", { method: "DELETE" }).catch(() => {});
        set({ fullTourActive: false, activePageId: null, tourDismissed: true, testRequestId: null, tourPaused: false, pausedPageId: null });
        saveToServer({ tourCompleted: false, tourDismissed: true });
      },

      startPageTour: (pageId) => set({ activePageId: pageId, currentStepInPage: 0, tourPaused: false, pausedPageId: null }),
      nextStepInPage: () => set((s) => ({ currentStepInPage: s.currentStepInPage + 1 })),
      prevStepInPage: () => set((s) => ({ currentStepInPage: Math.max(0, s.currentStepInPage - 1) })),
      completePageTour: () => {
        const { activePageId, touredPages, fullTourActive, testRequestId } = get();
        if (activePageId === "requests" && testRequestId) {
          deleteTestRequest();
        }
        const updated = activePageId && !touredPages.includes(activePageId)
          ? [...touredPages, activePageId]
          : touredPages;
        set({ touredPages: updated, activePageId: null, currentStepInPage: 0, testRequestId: null });
        if (updated !== touredPages) saveToServer({ touredPages: updated });
        if (fullTourActive) get().advanceFullTour();
      },
      skipPageTour: () => {
        const { activePageId, touredPages, testRequestId } = get();
        if (activePageId === "requests" && testRequestId) {
          deleteTestRequest();
        }
        const updated = activePageId && !touredPages.includes(activePageId)
          ? [...touredPages, activePageId]
          : touredPages;
        set({ touredPages: updated, activePageId: null, currentStepInPage: 0, testRequestId: null });
        if (updated !== touredPages) saveToServer({ touredPages: updated });
      },

      setTestRequestId: (id) => set({ testRequestId: id }),
      resetSync: () => set({ synced: false, tourCompleted: false, tourDismissed: false }),
      syncFromServer: async () => {
        if (get().synced) return;
        try {
          const res = await fetch("/api/v1/onboarding/tour-state");
          if (res.ok) {
            const data = await res.json();
            const serverPages: string[] = data.touredPages ?? [];
            const localPages = get().touredPages;
            const storedUserId = get().userId;
            const currentUserId: string | null = data.userId ?? null;
            const isDifferentUser = storedUserId !== null && currentUserId !== null && storedUserId !== currentUserId;

            const update: Partial<OnboardingTourState> = {
              tourCompleted: data.tourCompleted,
              tourDismissed: data.tourDismissed,
              synced: true,
              userId: currentUserId,
            };

            if (isDifferentUser) {
              // Different user on the same browser: clear stale local state,
              // use only the server data for this account.
              update.touredPages = serverPages;
              update.fullTourPageIndex = 0;
              update.tourPaused = false;
              update.pausedPageId = null;
              update.pausedStepIndex = 0;
              update.pausedWasFullTour = false;
            } else {
              // Same user (or first sync): merge server + local.
              // Local may have pages saved before a server-save completed,
              // so keep the union to avoid restarting skipped tours.
              update.touredPages = Array.from(new Set([...serverPages, ...localPages]));
            }
            set(update);
          }
        } catch {}
      },
    }),
    {
      name: "okrunit-onboarding-tour",
      partialize: (state) => ({
        fullTourPageIndex: state.fullTourPageIndex,
        // tourCompleted and tourDismissed are NOT persisted to localStorage.
        // The database is the source of truth (via syncFromServer). Persisting
        // these caused stale values from previous accounts to hide the banner
        // for new users on the same browser.
        touredPages: state.touredPages,
        tourPaused: state.tourPaused,
        pausedPageId: state.pausedPageId,
        pausedStepIndex: state.pausedStepIndex,
        pausedWasFullTour: state.pausedWasFullTour,
        hasSeenPauseHint: state.hasSeenPauseHint,
        // userId is persisted so we can detect when a different user logs in
        // on the same browser and clear stale local state.
        userId: state.userId,
      }),
    },
  ),
);
