"use client";

import { useState, useEffect } from "react";
import { Download, X, Share, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPromptStore } from "@/stores/install-prompt-store";

/**
 * A banner that prompts users to install the app to their home screen.
 * On Chrome/Edge/Android it uses the native install prompt.
 * On iOS Safari it shows manual instructions.
 */
export function InstallBanner() {
  const { deferredPrompt, dismissed, isInstalled, setDeferredPrompt, dismiss } =
    useInstallPromptStore();
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream);
  }, []);

  // Don't show if already installed, dismissed, or not eligible
  if (isInstalled || dismissed) return null;
  if (!deferredPrompt && !isIOS) return null;

  async function handleInstall() {
    if (deferredPrompt) {
      setInstalling(true);
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        }
      } finally {
        setInstalling(false);
      }
    }
  }

  return (
    <>
      <div className="pwa-install-prompt fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 fade-in duration-300 sm:left-auto sm:right-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Download className="size-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Install OKrunit
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Add to your home screen for quick access and a native app experience.
              </p>
              <div className="mt-3 flex items-center gap-2">
                {isIOS ? (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => setShowIOSGuide(true)}
                  >
                    <Share className="size-3.5" />
                    How to Install
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={handleInstall}
                    disabled={installing}
                  >
                    <Download className="size-3.5" />
                    {installing ? "Installing..." : "Install App"}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-muted-foreground"
                  onClick={dismiss}
                >
                  Not now
                </Button>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Dismiss"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* iOS installation guide modal */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setShowIOSGuide(false)}
          />
          <div className="relative w-full max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-200 rounded-2xl bg-card p-6 shadow-xl">
            <button
              onClick={() => setShowIOSGuide(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-4" />
            </button>

            <div className="text-center">
              <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary/10">
                <Download className="size-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">
                Install OKrunit
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Follow these steps to add OKrunit to your home screen:
              </p>
            </div>

            <ol className="mt-5 space-y-4">
              <li className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  1
                </span>
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Tap the Share button
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                    <Share className="size-3.5" />
                    at the bottom of Safari
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  2
                </span>
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Scroll down and tap
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-muted-foreground">
                    <Plus className="size-3.5" />
                    &quot;Add to Home Screen&quot;
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  3
                </span>
                <div className="text-sm">
                  <p className="font-medium text-foreground">
                    Tap &quot;Add&quot; to confirm
                  </p>
                  <p className="mt-0.5 text-muted-foreground">
                    OKrunit will appear on your home screen
                  </p>
                </div>
              </li>
            </ol>

            <Button
              className="mt-6 w-full"
              onClick={() => {
                setShowIOSGuide(false);
                dismiss();
              }}
            >
              Got it
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
