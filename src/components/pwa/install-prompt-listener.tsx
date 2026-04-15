"use client";

import { useEffect } from "react";
import { useInstallPromptStore } from "@/stores/install-prompt-store";

/**
 * Invisible component that listens for the browser's beforeinstallprompt event
 * and stores it so we can trigger it later from a custom UI.
 * Mount this once in the root layout.
 */
export function InstallPromptListener() {
  const { setDeferredPrompt, setInstalled, dismiss } = useInstallPromptStore();

  useEffect(() => {
    // Check if already installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setInstalled(true);
      return;
    }

    // Check if user previously dismissed (within last 7 days)
    try {
      const dismissedAt = localStorage.getItem("okrunit-install-dismissed");
      if (dismissedAt) {
        const daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
        if (daysSince < 7) {
          dismiss();
        } else {
          localStorage.removeItem("okrunit-install-dismissed");
        }
      }
    } catch {
      // localStorage unavailable
    }

    function handleBeforeInstall(e: Event) {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      setDeferredPrompt(e as unknown as Parameters<typeof setDeferredPrompt>[0]);
    }

    function handleAppInstalled() {
      setInstalled(true);
      setDeferredPrompt(null);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [setDeferredPrompt, setInstalled, dismiss]);

  return null;
}
