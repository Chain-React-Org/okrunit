"use client";

import { useState, useEffect } from "react";
import { Info, X } from "lucide-react";
import Link from "next/link";

interface TierLimitBannerProps {
  /** localStorage key suffix. Must be unique per page */
  dismissKey: string;
  /** The plan name to display, e.g. "Free" */
  planName: string;
  /** Main message describing the limit */
  message: string;
  /** Optional override for the upgrade link (defaults to /org/billing) */
  upgradePath?: string;
}

export function TierLimitBanner({
  dismissKey,
  planName,
  message,
  upgradePath = "/org/billing",
}: TierLimitBannerProps) {
  const storageKey = `okrunit:${dismissKey}-dismissed`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(storageKey) === "1");
  }, [storageKey]);

  if (dismissed) return null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">
        <span className="font-medium">{planName}</span> plan: {message}{" "}
        <Link
          href={upgradePath}
          className="font-medium underline underline-offset-2 hover:text-blue-900 dark:hover:text-blue-200"
        >
          Upgrade your plan
        </Link>{" "}
        for more.
      </p>
      <button
        onClick={() => {
          localStorage.setItem(storageKey, "1");
          setDismissed(true);
        }}
        className="mt-0.5 shrink-0 rounded-md p-0.5 hover:bg-blue-200/60 dark:hover:bg-blue-800/40"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
