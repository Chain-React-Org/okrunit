import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for OKrunit native apps.
 *
 * This app uses server-side rendering (Next.js API routes, server components,
 * Supabase SSR), so we load from the live production URL rather than a static
 * export. The native shell provides push notifications, haptics, status bar
 * theming, and app store distribution.
 *
 * For local development, set CAPACITOR_SERVER_URL=http://localhost:3000
 */

const serverUrl =
  process.env.CAPACITOR_SERVER_URL || "https://okrunit.com";

const config: CapacitorConfig = {
  appId: "com.okrunit.app",
  appName: "OKrunit",
  // webDir is required by Capacitor but we load from a live URL.
  // We point it at a minimal static fallback directory.
  webDir: "capacitor-web",
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith("http://"),
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#2e7d32",
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    scheme: "OKrunit",
    allowsLinkPreview: true,
  },
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
