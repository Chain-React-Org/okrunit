"use client";

import { useEffect } from "react";
import { isNative, initNativePlugins } from "@/lib/capacitor";

/**
 * Initializes Capacitor native plugins when running inside a native shell.
 * No-ops when running as a regular web app or PWA.
 * Mount once in the root layout.
 */
export function NativeBridge() {
  useEffect(() => {
    if (isNative()) {
      initNativePlugins();
    }
  }, []);

  return null;
}
