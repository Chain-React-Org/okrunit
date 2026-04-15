/**
 * Capacitor native bridge utilities.
 *
 * These functions are safe to call in the browser (they no-op when not running
 * inside a native Capacitor shell). This lets the same codebase work as both
 * a PWA and a native app.
 */

import { Capacitor } from "@capacitor/core";

/** True when running inside a native iOS/Android shell */
export function isNative(): boolean {
  return Capacitor.isNativePlatform();
}

/** Get the current platform: "ios" | "android" | "web" */
export function getPlatform(): string {
  return Capacitor.getPlatform();
}

/**
 * Initialize native plugins (call once on app mount).
 * Safe to call on web, it will skip native-only setup.
 */
export async function initNativePlugins(): Promise<void> {
  if (!isNative()) return;

  try {
    // Hide the splash screen after the app has loaded
    const { SplashScreen } = await import("@capacitor/splash-screen");
    await SplashScreen.hide();
  } catch {
    // Plugin not available
  }

  try {
    // Set status bar style
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: "#2e7d32" });
  } catch {
    // Plugin not available or web
  }

  try {
    // Handle deep links / back button on Android
    const { App: CapApp } = await import("@capacitor/app");
    CapApp.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    });
  } catch {
    // Plugin not available
  }
}

/**
 * Register for native push notifications.
 * Returns the device token (FCM on Android, APNs on iOS).
 * Returns null on web or if the user denies permission.
 */
export async function registerNativePush(): Promise<string | null> {
  if (!isNative()) return null;

  try {
    const { PushNotifications } = await import(
      "@capacitor/push-notifications"
    );

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") return null;

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener("registration", (token) => {
        resolve(token.value);
      });
      PushNotifications.addListener("registrationError", () => {
        resolve(null);
      });
      // Timeout after 10 seconds
      setTimeout(() => resolve(null), 10000);
    });
  } catch {
    return null;
  }
}

/**
 * Trigger a light haptic feedback (tap).
 * No-ops on web.
 */
export async function hapticTap(): Promise<void> {
  if (!isNative()) return;

  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {
    // Not available
  }
}
