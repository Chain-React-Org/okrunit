import { create } from "zustand";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallPromptState {
  /** The deferred browser install prompt (Chrome/Edge/Android) */
  deferredPrompt: BeforeInstallPromptEvent | null;
  /** Whether the user has dismissed the custom install banner */
  dismissed: boolean;
  /** Whether the app is already installed (standalone mode) */
  isInstalled: boolean;

  setDeferredPrompt: (prompt: BeforeInstallPromptEvent | null) => void;
  dismiss: () => void;
  setInstalled: (installed: boolean) => void;
}

export const useInstallPromptStore = create<InstallPromptState>((set) => ({
  deferredPrompt: null,
  dismissed: false,
  isInstalled: false,
  setDeferredPrompt: (prompt) => set({ deferredPrompt: prompt }),
  dismiss: () => {
    set({ dismissed: true });
    try {
      localStorage.setItem("okrunit-install-dismissed", Date.now().toString());
    } catch {
      // localStorage unavailable
    }
  },
  setInstalled: (installed) => set({ isInstalled: installed }),
}));
