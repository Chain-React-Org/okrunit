import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono, DM_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import { WebVitalsReporter } from "@/components/web-vitals-reporter";
import { UTMTracker } from "@/components/tracking/utm-tracker";
import { InstallPromptListener } from "@/components/pwa/install-prompt-listener";
import { InstallBanner } from "@/components/pwa/install-banner";
import { NativeBridge } from "@/components/pwa/native-bridge";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "OKrunit - Human-in-the-Loop Approval Gateway for AI Agents & Automations",
    template: "%s | OKrunit",
  },
  description:
    "Add human approval to any automation workflow. OKrunit pauses AI agents, Zapier zaps, Make scenarios, and n8n workflows until a human approves. One API call. Approve from Slack, email, or dashboard.",
  keywords: [
    "human-in-the-loop",
    "approval gateway",
    "AI agent approval",
    "automation approval",
    "Zapier approval",
    "Make.com approval",
    "n8n approval",
    "workflow approval",
    "human approval API",
    "AI safety",
    "destructive action prevention",
  ],
  metadataBase: new URL("https://okrunit.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "OKrunit - Human Approval for Every Automation",
    description:
      "Add human approval to any automation workflow. One API call pauses execution until a human approves. Works with Zapier, Make, n8n, Slack, and any REST API.",
    url: "https://okrunit.com",
    siteName: "OKrunit",
    type: "website",
    images: [
      {
        url: "https://okrunit.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "OKrunit dashboard showing approval requests, analytics, and recent activity",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OKrunit - Human Approval for Every Automation",
    description:
      "Add human approval to any automation workflow. One API call pauses execution until a human approves.",
    images: ["https://okrunit.com/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OKrunit",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#2e7d32",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${dmSans.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
          <ClientErrorReporter />
          <Suspense><WebVitalsReporter /></Suspense>
          <UTMTracker />
          <InstallPromptListener />
          <InstallBanner />
          <NativeBridge />
        </ThemeProvider>
      </body>
    </html>
  );
}
